import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * "Servizi": calendari prenotabili (Prompt Master, richiesta utente: piu'
 * tipologie di appuntamento per gestire collaboratori o servizi diversi in
 * parallelo, ciascuno con propria durata slot, capienza, orario e pausa
 * pranzo) unificati con vetrina prezzi pubblica (ex Tariffe) e dati di
 * fatturazione (ex Listino).
 */
export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("all") === "1";
  const appointmentTypes = await prisma.appointmentType.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ appointmentTypes });
}

const bodySchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(480),
  capacity: z.number().int().min(1).max(500),
  requiresApproval: z.boolean(),
  subtitle: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  priceUnit: z.enum(["PER_SESSION", "PACKAGE"]).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  vatNature: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  showInServiceList: z.boolean().optional(),
  showInTariffs: z.boolean().optional(),
  bookingKind: z.enum(["ONE_TIME", "SUBSCRIPTION"]).optional(),
});

/** Crea un nuovo servizio con orario settimanale chiuso di default. */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.appointmentType.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "Esiste gia' un servizio con questo nome." }, { status: 409 });
  }

  // Nessuna fascia oraria creata di default: un calendario senza
  // ScheduleBand e' gia' chiuso su tutti i giorni.
  const appointmentType = await prisma.appointmentType.create({ data: parsed.data });

  return NextResponse.json({ appointmentType });
}
