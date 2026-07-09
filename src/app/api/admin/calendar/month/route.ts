import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDaySlots } from "@/lib/schedule";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants";
import { addDays, endOfMonth, formatISO, startOfMonth } from "date-fns";

/** Riepilogo mese per il calendario admin: stato di ogni giorno per navigare rapidamente. */
export async function GET(request: NextRequest) {
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  const monthParam = request.nextUrl.searchParams.get("month"); // "YYYY-MM"
  if (!appointmentTypeId || !monthParam) {
    return NextResponse.json({ error: "appointmentTypeId e month richiesti" }, { status: 400 });
  }

  const [year, month] = monthParam.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const bookings = await prisma.booking.findMany({
    where: {
      appointmentTypeId,
      startTime: { gte: monthStart, lt: addDays(monthEnd, 1) },
      status: { in: ACTIVE_BOOKING_STATUSES },
    },
    select: { startTime: true },
  });

  const bookingCountByDay = new Map<string, number>();
  for (const b of bookings) {
    const key = formatISO(b.startTime, { representation: "date" });
    bookingCountByDay.set(key, (bookingCountByDay.get(key) ?? 0) + 1);
  }

  const days = [];
  let cursor = monthStart;
  while (cursor <= monthEnd) {
    const { window, slots } = await generateDaySlots(appointmentTypeId, cursor);
    const dateKey = formatISO(cursor, { representation: "date" });
    days.push({
      date: dateKey,
      isOpen: window.isOpen,
      hasNote: !!window.note,
      totalSlots: slots.length,
      disabledSlots: slots.filter((s) => s.isDisabled).length,
      bookingsCount: bookingCountByDay.get(dateKey) ?? 0,
    });
    cursor = addDays(cursor, 1);
  }

  return NextResponse.json({ month: monthParam, days });
}
