import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BookingRuleError, createCustomBooking } from "@/lib/booking-rules";
import { sendAdminCreatedBookingSummaryEmail } from "@/lib/mailer";

export async function GET() {
  const items = await prisma.subscription.findMany({
    orderBy: { endDate: "asc" },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      appointmentType: { select: { id: true, name: true, unitPrice: true } },
    },
  });
  return NextResponse.json({ items });
}

const occurrenceSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

const bodySchema = z
  .object({
    // Cliente esistente: solo l'id. Cliente nuovo: nome/cognome/email
    // obbligatori, telefono/data di nascita/sesso facoltativi.
    clientId: z.string().min(1).optional(),
    clientEmail: z.string().trim().toLowerCase().email("Email non valida").optional(),
    clientFirstName: z.string().min(1).optional(),
    clientLastName: z.string().min(1).optional(),
    clientPhone: z.string().optional(),
    clientDateOfBirth: z.string().optional(),
    clientSex: z.enum(["M", "F", "OTHER"]).optional(),
    appointmentTypeId: z.string().min(1),
    startDate: z.string().min(1), // ISO date
    endDate: z.string().min(1),
    autoRenew: z.boolean().optional(),
    renewMonths: z.number().int().min(1).max(36).optional(),
    notifyDaysBefore: z.number().int().min(0).max(90).optional(),
    // Sedute generate dal wizard "Nuovo abbonamento" per la ricorrenza scelta
    // (facoltative: un abbonamento puo' anche esistere senza sedute pre-generate).
    occurrences: z.array(occurrenceSchema).max(400).optional(),
  })
  .refine((d) => d.clientId || (d.clientEmail && d.clientFirstName && d.clientLastName), {
    message: "Serve un cliente esistente oppure nome, cognome ed email per crearne uno nuovo.",
  });

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  if (new Date(data.endDate) <= new Date(data.startDate)) {
    return NextResponse.json({ error: "La scadenza deve essere successiva alla data di inizio." }, { status: 400 });
  }

  let client;
  if (data.clientId) {
    client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
    }
  } else {
    client = await prisma.client.upsert({
      where: { email: data.clientEmail! },
      update: { firstName: data.clientFirstName!, lastName: data.clientLastName! },
      create: {
        email: data.clientEmail!,
        firstName: data.clientFirstName!,
        lastName: data.clientLastName!,
        phone: data.clientPhone || undefined,
        dateOfBirth: data.clientDateOfBirth ? new Date(data.clientDateOfBirth) : undefined,
        sex: data.clientSex,
      },
    });
  }

  const item = await prisma.subscription.create({
    data: {
      clientId: client.id,
      appointmentTypeId: data.appointmentTypeId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      autoRenew: data.autoRenew,
      renewMonths: data.renewMonths,
      notifyDaysBefore: data.notifyDaysBefore,
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      appointmentType: { select: { id: true, name: true, unitPrice: true } },
    },
  });

  const bookingErrors: { index: number; startTime: string; error: string }[] = [];
  const createdBookings = [];
  if (data.occurrences && data.occurrences.length > 0) {
    for (let i = 0; i < data.occurrences.length; i++) {
      const occ = data.occurrences[i];
      try {
        const booking = await createCustomBooking({
          clientId: client.id,
          appointmentTypeId: data.appointmentTypeId,
          startTime: new Date(occ.startTime),
          endTime: new Date(occ.endTime),
          source: "custom",
          bypassConstraints: true,
          subscriptionId: item.id,
        });
        createdBookings.push(booking);
      } catch (err) {
        if (err instanceof BookingRuleError) {
          bookingErrors.push({ index: i, startTime: occ.startTime, error: err.message });
        } else {
          bookingErrors.push({ index: i, startTime: occ.startTime, error: "Errore durante la creazione della seduta" });
        }
      }
    }

    try {
      await sendAdminCreatedBookingSummaryEmail({
        client: { firstName: client.firstName, lastName: client.lastName, email: client.email },
        appointmentTypeName: item.appointmentType.name,
        occurrences: createdBookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
      });
    } catch (err) {
      console.error("[api/admin/subscriptions] invio riepilogo email fallito:", err);
    }
  }

  return NextResponse.json({ item, bookingErrors });
}
