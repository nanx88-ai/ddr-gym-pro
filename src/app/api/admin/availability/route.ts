import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDayOccupancyMap } from "@/lib/booking-rules";
import { generateDaySlots } from "@/lib/schedule";
import { parseISO, addDays } from "date-fns";
import { startOfDayInRome } from "@/lib/timezone";

/**
 * Disponibilita' per una data ad uso admin (wizard "Nuova prenotazione"): a
 * differenza di /api/availability (pubblica) non filtra per
 * showInServiceList/isPast, cosi' l'admin vede e puo' scegliere anche slot
 * gia' pieni o nel passato (per registrare un walk-in) - la creazione vera e
 * propria bypassa comunque i vincoli (vedi /api/admin/bookings), qui serve
 * solo a mostrare visivamente l'occupazione.
 */
export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  if (!appointmentTypeId) {
    return NextResponse.json({ error: "appointmentTypeId richiesto" }, { status: 400 });
  }
  const date = dateParam ? parseISO(dateParam) : new Date();

  const type = await prisma.appointmentType.findUnique({ where: { id: appointmentTypeId } });
  if (!type) {
    return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
  }

  const dayStart = startOfDayInRome(date);
  const dayEnd = addDays(dayStart, 1);

  const { window, slots } = await generateDaySlots(type.id, date);
  const occupancyFor = await getDayOccupancyMap(type.id, dayStart, dayEnd);

  const bookableSlots = slots
    .filter((slot) => !slot.isDisabled && slot.capacity > 0)
    .map((slot) => {
      const occupancy = occupancyFor(slot.startTime);
      return {
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        capacity: slot.capacity,
        confirmed: occupancy.confirmed,
        pending: occupancy.pending,
        spotsLeft: Math.max(0, slot.capacity - occupancy.total),
        full: occupancy.total >= slot.capacity,
        isPast: slot.isPast,
      };
    });

  return NextResponse.json({
    closedNote: !window.isOpen ? window.note : null,
    slots: bookableSlots,
  });
}
