import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const WEEKDAY_LABELS = ["Domenica", "Lunedi'", "Martedi'", "Mercoledi'", "Giovedi'", "Venerdi'", "Sabato"];

/**
 * Statistiche base per l'admin: giorni della settimana piu' attivi (per
 * numero di prenotazioni non annullate/rifiutate) e clienti con piu'
 * prenotazioni. Prima iterazione, altre statistiche si aggiungeranno qui.
 */
export async function GET() {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["APPROVED", "RESCHEDULED", "PENDING_APPROVAL"] } },
    select: {
      startTime: true,
      clientId: true,
      client: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  const byWeekday = new Array(7).fill(0);
  const byClient = new Map<string, { firstName: string; lastName: string; email: string; count: number }>();

  for (const b of bookings) {
    byWeekday[new Date(b.startTime).getDay()]++;

    const existing = byClient.get(b.clientId);
    if (existing) {
      existing.count++;
    } else {
      byClient.set(b.clientId, {
        firstName: b.client.firstName,
        lastName: b.client.lastName,
        email: b.client.email,
        count: 1,
      });
    }
  }

  const activeDays = byWeekday
    .map((count, dayOfWeek) => ({ dayOfWeek, label: WEEKDAY_LABELS[dayOfWeek], count }))
    .sort((a, b) => b.count - a.count);

  const topClients = [...byClient.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return NextResponse.json({ totalBookings: bookings.length, activeDays, topClients });
}
