import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveCapacity, getSlotOccupancy } from "@/lib/booking-rules";

/**
 * Notifiche per il pannello admin: per ora solo le richieste di prenotazione
 * in attesa di approvazione, arricchite con i posti ancora disponibili per
 * quello slot (capienza - confermati - in attesa), cosi' l'admin vede subito
 * quanto margine ha senza dover andare a cercarlo altrove.
 */
export async function GET() {
  const bookings = await prisma.booking.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: { startTime: "asc" },
    include: { client: true, appointmentType: true },
  });

  const items = await Promise.all(
    bookings.map(async (b) => {
      const { capacity } = await getEffectiveCapacity(b.appointmentTypeId, b.startTime, b.appointmentType.capacity);
      const occupancy = await getSlotOccupancy(b.appointmentTypeId, b.startTime);
      return {
        id: b.id,
        startTime: b.startTime,
        client: { firstName: b.client.firstName, lastName: b.client.lastName },
        appointmentType: { name: b.appointmentType.name },
        capacity,
        spotsLeft: Math.max(0, capacity - occupancy.total),
      };
    })
  );

  return NextResponse.json({ items });
}
