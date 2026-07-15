import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDayOccupancyMap } from "@/lib/booking-rules";
import { generateDaySlots } from "@/lib/schedule";
import { formatISO, parseISO, addDays } from "date-fns";
import { startOfDayInRome } from "@/lib/timezone";

/**
 * Disponibilita' per una data, con conteggio separato confermati/pending
 * (requisito frontend cliente, Prompt Master sezione 3.2 e 6).
 *
 * Gli orari sono generati da lib/schedule.ts (orario settimanale + eccezioni
 * + pausa pranzo + override per singolo slot), gestiti dall'admin in
 * /admin/calendar e /admin/schedule. Gli slot disattivati dall'admin non
 * sono restituiti qui.
 */
export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam ? parseISO(dateParam) : new Date();

  try {
    const appointmentTypes = await prisma.appointmentType.findMany({ where: { active: true, showInServiceList: true } });
    if (appointmentTypes.length === 0) {
      return NextResponse.json({ date: formatISO(date, { representation: "date" }), appointmentTypes: [] });
    }

    const dayStart = startOfDayInRome(date);
    const dayEnd = addDays(dayStart, 1);

    const results = [];
    for (const type of appointmentTypes) {
      const { window, slots } = await generateDaySlots(type.id, date);
      const occupancyFor = await getDayOccupancyMap(type.id, dayStart, dayEnd);

      const bookableSlots = [];
      for (const slot of slots) {
        if (slot.isDisabled || slot.capacity <= 0 || slot.isPast) continue;
        const occupancy = occupancyFor(slot.startTime);
        bookableSlots.push({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          capacity: slot.capacity,
          confirmed: occupancy.confirmed,
          pending: occupancy.pending,
          spotsLeft: Math.max(0, slot.capacity - occupancy.total),
          full: occupancy.total >= slot.capacity,
        });
      }

      results.push({
        appointmentTypeId: type.id,
        name: type.name,
        durationMinutes: type.durationMinutes,
        requiresApproval: type.requiresApproval,
        closedNote: !window.isOpen ? window.note : null,
        slots: bookableSlots,
      });
    }

    return NextResponse.json({
      date: formatISO(date, { representation: "date" }),
      appointmentTypes: results,
    });
  } catch (err) {
    console.error("[api/availability] errore:", err);
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore di connessione al database: ${message}` }, { status: 500 });
  }
}
