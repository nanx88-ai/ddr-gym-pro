import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BOOKING_STATUS } from "@/lib/constants";
import { hasConflictingBooking } from "@/lib/booking-rules";

/**
 * Riceve gli eventi webhook di Koalendar (booking creato/modificato/cancellato).
 *
 * ASSUNZIONE NON VERIFICATA (Prompt Master sezione 9, "GAP DA COLMARE"):
 * la forma esatta del payload webhook di Koalendar non e' stata confermata
 * nell'audit. Questo endpoint assume una struttura ragionevole ispirata alle
 * schermate osservate (evento, id prenotazione, dati ospite, tipo appuntamento,
 * orario, stato). Va validata/adattata con un webhook reale prima della messa
 * in produzione: vedi anche KOALENDAR_WEBHOOK_SECRET in .env per la verifica
 * della firma, non ancora confermata come disponibile lato Koalendar.
 */

interface KoalendarWebhookPayload {
  event: "booking.created" | "booking.updated" | "booking.cancelled" | string;
  booking: {
    id: string;
    appointment_type_name: string;
    start_time: string;
    end_time: string;
    status?: string; // es. "confirmed" | "pending" | "cancelled"
    guest: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
    };
  };
}

function mapKoalendarStatus(event: string, status: string | undefined) {
  if (event === "booking.cancelled") return BOOKING_STATUS.CANCELLED;
  if (status === "pending") return BOOKING_STATUS.PENDING_APPROVAL;
  if (status === "cancelled") return BOOKING_STATUS.CANCELLED;
  return BOOKING_STATUS.APPROVED;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.KOALENDAR_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get("x-koalendar-signature");
    if (signature !== secret) {
      return NextResponse.json({ error: "Firma non valida" }, { status: 401 });
    }
  }

  const event = await prisma.webhookEvent.create({
    data: { source: "koalendar", eventType: "unknown", payload: rawBody, processed: false },
  });

  let payload: KoalendarWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: "Payload non e' JSON valido" },
    });
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 });
  }

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { eventType: payload.event ?? "unknown" },
  });

  try {
    const { booking } = payload;
    if (!booking) throw new Error("Campo 'booking' mancante nel payload");

    const client = await prisma.client.upsert({
      where: { email: booking.guest.email },
      update: {
        firstName: booking.guest.first_name,
        lastName: booking.guest.last_name,
        phone: booking.guest.phone,
      },
      create: {
        email: booking.guest.email,
        firstName: booking.guest.first_name,
        lastName: booking.guest.last_name,
        phone: booking.guest.phone,
      },
    });

    const appointmentType = await prisma.appointmentType.upsert({
      where: { name: booking.appointment_type_name },
      update: {},
      create: { name: booking.appointment_type_name, durationMinutes: 60 },
    });

    const status = mapKoalendarStatus(payload.event, booking.status);
    const startTime = new Date(booking.start_time);

    // Riconciliazione del gap "1 utente = max 1 prenotazione per fascia oraria"
    // (Prompt Master sezione 5.2): Koalendar non blocca questo caso nativamente,
    // quindi qui rileviamo il duplicato dopo il fatto e lo segnaliamo come
    // conflitto invece di annullarlo in automatico, per evitare di cancellare
    // silenziosamente una prenotazione reale del cliente.
    const existing = await prisma.booking.findUnique({
      where: { koalendarBookingId: booking.id },
    });

    if (!existing && status !== BOOKING_STATUS.CANCELLED) {
      const conflict = await hasConflictingBooking(client.id, startTime);
      if (conflict) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            error: `Conflitto rilevato: il cliente ${client.email} ha gia' una prenotazione attiva alle ${startTime.toISOString()}. Richiede revisione manuale in dashboard admin.`,
          },
        });
      }
    }

    await prisma.booking.upsert({
      where: { koalendarBookingId: booking.id },
      update: {
        status,
        startTime,
        endTime: new Date(booking.end_time),
      },
      create: {
        koalendarBookingId: booking.id,
        clientId: client.id,
        appointmentTypeId: appointmentType.id,
        startTime,
        endTime: new Date(booking.end_time),
        status,
        source: "koalendar_webhook",
      },
    });

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processed: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: err instanceof Error ? err.message : "Errore sconosciuto" },
    });
    return NextResponse.json({ error: "Errore durante l'elaborazione" }, { status: 500 });
  }
}
