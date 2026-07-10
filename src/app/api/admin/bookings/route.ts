import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BookingRuleError, createCustomBooking } from "@/lib/booking-rules";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const bookings = await prisma.booking.findMany({
    where: status ? { status } : undefined,
    orderBy: { startTime: "asc" },
    include: {
      client: true,
      appointmentType: true,
      rescheduleRequests: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json({ bookings });
}

const itemSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  isRecurring: z.boolean().optional(),
  recurrenceGroupId: z.string().optional(),
});

const bodySchema = z.object({
  clientEmail: z.string().trim().toLowerCase().email("Email non valida"),
  clientFirstName: z.string().min(1),
  clientLastName: z.string().min(1),
  appointmentTypeId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1).max(60),
});

/**
 * Creazione manuale di appuntamenti dal pannello admin (Prompt Master 3.3 /
 * 7): il trainer decide, quindi nessun vincolo (data passata, conflitto
 * orario, slot disattivato, capienza massima) - a differenza del booking
 * pubblico. Supporta piu' `items` in un'unica richiesta per le serie
 * ricorrenti, stesso pattern di /api/bookings.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const client = await prisma.client.upsert({
    where: { email: data.clientEmail },
    update: { firstName: data.clientFirstName, lastName: data.clientLastName },
    create: {
      email: data.clientEmail,
      firstName: data.clientFirstName,
      lastName: data.clientLastName,
    },
  });

  const bookings = [];
  const errors: { index: number; startTime: string; error: string; code?: string }[] = [];

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    try {
      const booking = await createCustomBooking({
        clientId: client.id,
        appointmentTypeId: data.appointmentTypeId,
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime),
        notes: data.notes,
        isRecurring: item.isRecurring,
        recurrenceGroupId: item.recurrenceGroupId,
        source: "custom",
        bypassConstraints: true,
      });
      bookings.push(booking);
    } catch (err) {
      if (err instanceof BookingRuleError) {
        errors.push({ index: i, startTime: item.startTime, error: err.message, code: err.code });
      } else {
        errors.push({ index: i, startTime: item.startTime, error: "Errore durante la creazione dell'appuntamento" });
      }
    }
  }

  if (bookings.length === 0) {
    return NextResponse.json({ error: "Nessun appuntamento creato", errors }, { status: 409 });
  }

  return NextResponse.json({ bookings, errors });
}
