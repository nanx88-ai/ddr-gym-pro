import { NextRequest, NextResponse } from "next/server";
import { addDays, formatISO, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { getSlotOccupancy } from "@/lib/booking-rules";
import { generateDaySlots } from "@/lib/schedule";

/**
 * Disponibilita' aggregata per un mese intero, per un singolo servizio: per
 * ogni giorno dice solo se e' completamente pieno/chiuso (`full`), usata dal
 * calendario pubblico per desaturare i giorni non prenotabili senza dover
 * caricare tutti gli slot di ogni giorno.
 */
export async function GET(request: NextRequest) {
  const monthParam = request.nextUrl.searchParams.get("month"); // "YYYY-MM"
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  if (!monthParam || !appointmentTypeId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const monthStart = startOfMonth(parseISO(`${monthParam}-01`));
  const monthEnd = endOfMonth(monthStart);

  const days: { date: string; full: boolean }[] = [];
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) {
    const { window, slots } = await generateDaySlots(appointmentTypeId, d);
    let full = true;
    if (window.isOpen) {
      for (const slot of slots) {
        if (slot.isDisabled || slot.capacity <= 0 || slot.isPast) continue;
        const occupancy = await getSlotOccupancy(appointmentTypeId, slot.startTime);
        if (occupancy.total < slot.capacity) {
          full = false;
          break;
        }
      }
    }
    days.push({ date: formatISO(d, { representation: "date" }), full });
  }

  return NextResponse.json({ days });
}
