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
      subscriptions: {
        orderBy: { endDate: "desc" },
        include: { tariff: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

const bodySchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  status: z.enum([CLIENT_STATUS.ACTIVE, CLIENT_STATUS.PAUSED, CLIENT_STATUS.ARCHIVED]).optional(),
  notes: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  sex: z.enum(["M", "F", "OTHER"]).nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
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

  try {
    const client = await prisma.client.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ client });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Email già in uso da un altro cliente" }, { status: 409 });
    }
    throw err;
  }
}

/**
 * Eliminazione definitiva: solo se il cliente non ha nessuna prenotazione o
 * fattura, altrimenti si rischia di cancellare storico/documenti fiscali. In
 * quel caso l'admin va indirizzato ad archiviare invece di eliminare.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { _count: { select: { bookings: true, invoices: true } } },
  });
  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (client._count.bookings > 0 || client._count.invoices > 0) {
    return NextResponse.json(
      { error: "Questo cliente ha prenotazioni o fatture: archivialo invece di eliminarlo, per non perdere lo storico." },
      { status: 409 }
    );
  }

  await prisma.reminder.deleteMany({ where: { clientId: id } });
  await prisma.billingProfile.deleteMany({ where: { clientId: id } });
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
