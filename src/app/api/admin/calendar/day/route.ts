import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDaySlots } from "@/lib/schedule";
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS } from "@/lib/constants";
import { addDays, formatISO, parseISO, startOfDay } from "date-fns";

/**
 * Vista giorno per il calendario admin: tutti gli slot del giorno (anche
 * quelli disattivati, per poterli riattivare), con prenotazioni associate.
 * Base per "mercoledi' 11 disattiva lo slot delle 10 e quello delle 16".
 */
export async function GET(request: NextRequest) {
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  const dateParam = request.nextUrl.searchParams.get("date");
  if (!appointmentTypeId || !dateParam) {
    return NextResponse.json({ error: "appointmentTypeId e date richiesti" }, { status: 400 });
  }

  const date = parseISO(dateParam);
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  const { type, window, slots } = await generateDaySlots(appointmentTypeId, date);

  const bookings = await prisma.booking.findMany({
    where: {
      appointmentTypeId,
      startTime: { gte: dayStart, lt: dayEnd },
      status: { in: ACTIVE_BOOKING_STATUSES },
    },
    include: { client: true },
    orderBy: { startTime: "asc" },
  });

  const bookingsByTime = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const key = booking.startTime.toISOString();
    bookingsByTime.set(key, [...(bookingsByTime.get(key) ?? []), booking]);
  }

  const slotsWithBookings = slots.map((slot) => {
    const slotBookings = bookingsByTime.get(slot.startTime.toISOString()) ?? [];
    const confirmed = slotBookings.filter(
      (b) => b.status === BOOKING_STATUS.APPROVED || b.status === BOOKING_STATUS.RESCHEDULED
    ).length;
    const pending = slotBookings.filter(
      (b) => b.status === BOOKING_STATUS.PENDING_APPROVAL || b.status === BOOKING_STATUS.RESCHEDULE_REQUESTED
    ).length;
    return {
      time: slot.time,
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      capacity: slot.capacity,
      defaultCapacity: slot.defaultCapacity,
      isDisabled: slot.isDisabled,
      overrideId: slot.overrideId,
      confirmed,
      pending,
      spotsLeft: Math.max(0, slot.capacity - confirmed - pending),
      bookings: slotBookings.map((b) => ({
        id: b.id,
        status: b.status,
        clientName: `${b.client.firstName} ${b.client.lastName}`,
        clientEmail: b.client.email,
      })),
    };
  });

  return NextResponse.json({
    date: formatISO(dayStart, { representation: "date" }),
    appointmentType: { id: type.id, name: type.name, durationMinutes: type.durationMinutes, capacity: type.capacity },
    isOpen: window.isOpen,
    note: window.note,
    openTime: window.openTime,
    closeTime: window.closeTime,
    breakStart: window.breakStart,
    breakEnd: window.breakEnd,
    slots: slotsWithBookings,
  });
}
