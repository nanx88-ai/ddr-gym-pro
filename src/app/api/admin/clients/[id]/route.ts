import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CLIENT_STATUS } from "@/lib/constants";

/** Dettaglio cliente: anagrafica + storico prenotazioni/presenze + fatture. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      billingProfile: { include: { priceListItem: true } },
      bookings: {
        orderBy: { startTime: "desc" },
        include: { appointmentType: true },
      },
      invoices: { orderBy: { issueDate: "desc" } },
      reminders: { orderBy: { dueDate: "asc" } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

const bodySchema = z.object({
  status: z.enum([CLIENT_STATUS.ACTIVE, CLIENT_STATUS.PAUSED]).optional(),
  notes: z.string().optional(),
  phone: z.string().optional(),
  clientKind: z.enum(["PRIVATO", "AZIENDA"]).nullable().optional(),
  businessName: z.string().nullable().optional(),
  fiscalCode: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  country: z.string().optional(),
  pec: z.string().nullable().optional(),
  sdiCode: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ client });
}

/**
 * Elimina un cliente. Le sue scadenze vengono rimosse insieme (nessun valore
 * storico); se invece ha prenotazioni, fatture o un profilo di fatturazione
 * collegati blocca ed suggerisce di metterlo in pausa invece.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await prisma.reminder.deleteMany({ where: { clientId: id } });

  try {
    await prisma.client.delete({ where: { id } });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "Questo cliente ha prenotazioni o fatture collegate: mettilo in pausa invece di eliminarlo." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
