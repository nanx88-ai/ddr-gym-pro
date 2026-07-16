import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const clients = await prisma.client.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
      // Solo i campi necessari ai filtri (servizio prenotato, ultima
      // prenotazione): non l'intero record booking, per non appesantire
      // la risposta con anagrafiche grandi.
      bookings: { select: { startTime: true, appointmentTypeId: true, appointmentType: { select: { name: true } } } },
      reminders: { where: { dueDate: { gte: new Date() } }, orderBy: { dueDate: "asc" }, take: 1, select: { dueDate: true, title: true } },
    },
  });
  return NextResponse.json({ clients });
}

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().trim().toLowerCase().email("Email non valida"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  sex: z.enum(["M", "F", "OTHER"]).optional(),
});

/** Crea un cliente direttamente dall'anagrafica (dati minimi: il resto si completa dopo dalla sua scheda). */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.client.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json({ error: "Esiste gia' un cliente con questa email." }, { status: 409 });
  }

  const client = await prisma.client.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      sex: data.sex,
    },
  });

  return NextResponse.json({ client });
}
