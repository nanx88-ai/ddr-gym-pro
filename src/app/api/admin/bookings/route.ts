import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BOOKING_STATUS } from "@/lib/constants";
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

const bodySchema = z.object({
  clientEmail: z.string().email(),
  clientFirstName: z.string().min(1),
  clientLastName: z.string().min(1),
  appointmentTypeId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  notes: z.string().optional(),
});

/** Creazione manuale di un appuntamento dal pannello admin (Prompt Master 3.3 / 7). */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const client = await prisma.client.upsert({
    where: { email: parsed.data.clientEmail },
    update: { firstName: parsed.data.clientFirstName, lastName: parsed.data.clientLastName },
    create: {
      email: parsed.data.clientEmail,
      firstName: parsed.data.clientFirstName,
      lastName: parsed.data.clientLastName,
    },
  });

  try {
    const booking = await createCustomBooking({
      clientId: client.id,
      appointmentTypeId: parsed.data.appointmentTypeId,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
      notes: parsed.data.notes,
      source: "custom",
    });

    // Le prenotazioni create dall'admin sono considerate gia' confermate,
    // a differenza di quelle inserite autonomamente dal cliente.
    const confirmed = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BOOKING_STATUS.APPROVED },
      include: { client: true, appointmentType: true },
    });

    return NextResponse.json({ booking: confirmed });
  } catch (err) {
    if (err instanceof BookingRuleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    return NextResponse.json({ error: "Errore durante la creazione" }, { status: 500 });
  }
}
