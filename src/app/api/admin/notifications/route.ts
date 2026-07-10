import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveCapacity, getSlotOccupancy } from "@/lib/booking-rules";

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 giorni
const REMINDER_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

/**
 * Notifiche per il pannello admin: tutto cio' che richiede attenzione o e'
 * successo di recente, non solo le richieste da approvare.
 * - actionable: richiedono una decisione (approva/rifiuta prenotazione o
 *   spostamento) - spariscono da sole appena risolte.
 * - informational: eventi recenti senza un'azione diretta da qui (nuova
 *   prenotazione auto-confermata, cancellazione, scadenza in arrivo) -
 *   l'admin le "smaltisce" scorrendole, restano visibili solo per una
 *   finestra di tempo cosi' non si accumulano all'infinito.
 */
export async function GET() {
  const now = new Date();
  const recentSince = new Date(now.getTime() - RECENT_WINDOW_MS);
  const reminderUntil = new Date(now.getTime() + REMINDER_LOOKAHEAD_MS);

  const [pendingBookings, pendingReschedules, newBookings, cancelledBookings, dueReminders] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { startTime: "asc" },
      include: { client: true, appointmentType: true },
    }),
    prisma.rescheduleRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { booking: { include: { client: true, appointmentType: true } } },
    }),
    prisma.booking.findMany({
      where: {
        status: "APPROVED",
        source: "custom",
        createdAt: { gte: recentSince },
        appointmentType: { requiresApproval: false },
      },
      orderBy: { createdAt: "desc" },
      include: { client: true, appointmentType: true },
    }),
    prisma.booking.findMany({
      where: { status: "CANCELLED", updatedAt: { gte: recentSince } },
      orderBy: { updatedAt: "desc" },
      include: { client: true, appointmentType: true },
    }),
    prisma.reminder.findMany({
      where: { dueDate: { gte: now, lte: reminderUntil } },
      orderBy: { dueDate: "asc" },
      include: { client: true },
    }),
  ]);

  // Le richieste di una stessa serie ricorrente (stesso recurrenceGroupId)
  // diventano UNA sola voce azionabile con tutti i bookingId dentro, invece
  // di bombardare il pannello con una riga per ogni occorrenza: approvare/
  // rifiutare quella voce decide sull'intera serie in un colpo solo.
  const singlePending = pendingBookings.filter((b) => !b.recurrenceGroupId);
  const seriesPendingGroups = new Map<string, typeof pendingBookings>();
  for (const b of pendingBookings) {
    if (!b.recurrenceGroupId) continue;
    const list = seriesPendingGroups.get(b.recurrenceGroupId);
    if (list) list.push(b);
    else seriesPendingGroups.set(b.recurrenceGroupId, [b]);
  }

  const actionable = await Promise.all(
    singlePending.map(async (b) => {
      const { capacity } = await getEffectiveCapacity(b.appointmentTypeId, b.startTime, b.appointmentType.capacity);
      const occupancy = await getSlotOccupancy(b.appointmentTypeId, b.startTime);
      return {
        type: "pending_approval" as const,
        id: `pending-${b.id}`,
        bookingId: b.id,
        startTime: b.startTime,
        client: { firstName: b.client.firstName, lastName: b.client.lastName },
        appointmentType: { name: b.appointmentType.name },
        capacity,
        spotsLeft: Math.max(0, capacity - occupancy.total),
      };
    })
  );

  const seriesActionable = [...seriesPendingGroups.entries()].map(([groupId, group]) => {
    const sorted = [...group].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const first = sorted[0];
    return {
      type: "pending_approval_series" as const,
      id: `pending-series-${groupId}`,
      recurrenceGroupId: groupId,
      bookingIds: sorted.map((b) => b.id),
      count: sorted.length,
      startTime: first.startTime,
      client: { firstName: first.client.firstName, lastName: first.client.lastName },
      appointmentType: { name: first.appointmentType.name },
    };
  });

  const rescheduleActionable = pendingReschedules.map((r) => ({
    type: "reschedule_request" as const,
    id: `reschedule-${r.id}`,
    requestId: r.id,
    startTime: r.requestedStartTime,
    reason: r.reason,
    client: { firstName: r.booking.client.firstName, lastName: r.booking.client.lastName },
    appointmentType: { name: r.booking.appointmentType.name },
  }));

  const singleNew = newBookings.filter((b) => !b.recurrenceGroupId);
  const seriesNewGroups = new Map<string, typeof newBookings>();
  for (const b of newBookings) {
    if (!b.recurrenceGroupId) continue;
    const list = seriesNewGroups.get(b.recurrenceGroupId);
    if (list) list.push(b);
    else seriesNewGroups.set(b.recurrenceGroupId, [b]);
  }
  const seriesNewInformational = [...seriesNewGroups.entries()].map(([groupId, group]) => {
    const sorted = [...group].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const first = sorted[0];
    const latestCreatedAt = sorted.reduce((max, b) => (b.createdAt > max ? b.createdAt : max), sorted[0].createdAt);
    return {
      type: "new_booking_series" as const,
      id: `new-series-${groupId}`,
      count: sorted.length,
      startTime: first.startTime,
      at: latestCreatedAt,
      client: { firstName: first.client.firstName, lastName: first.client.lastName },
      appointmentType: { name: first.appointmentType.name },
    };
  });

  const informational = [
    ...singleNew.map((b) => ({
      type: "new_booking" as const,
      id: `new-${b.id}`,
      startTime: b.startTime,
      at: b.createdAt,
      client: { firstName: b.client.firstName, lastName: b.client.lastName },
      appointmentType: { name: b.appointmentType.name },
    })),
    ...seriesNewInformational,
    ...cancelledBookings.map((b) => ({
      type: "cancellation" as const,
      id: `cancel-${b.id}`,
      startTime: b.startTime,
      at: b.updatedAt,
      client: { firstName: b.client.firstName, lastName: b.client.lastName },
      appointmentType: { name: b.appointmentType.name },
    })),
    ...dueReminders.map((r) => ({
      type: "reminder_due" as const,
      id: `reminder-${r.id}`,
      startTime: r.dueDate,
      at: r.dueDate,
      title: r.title,
      client: { firstName: r.client.firstName, lastName: r.client.lastName },
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({
    actionable: [...actionable, ...seriesActionable, ...rescheduleActionable],
    informational,
  });
}
