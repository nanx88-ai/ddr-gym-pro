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
  status: z.enum([CLIENT_STATUS.ACTIVE, CLIENT_STATUS.PAUSED, CLIENT_STATUS.ARCHIVED]).optional(),
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
