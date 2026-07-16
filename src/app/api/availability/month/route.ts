import { NextRequest, NextResponse } from "next/server";
import { addDays, addMinutes, isBefore, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants";
import { dateIsoInRome, romeWallTimeToInstant, startOfDayInRome } from "@/lib/timezone";
import { toHHMM } from "@/lib/schedule";
import { summarizeOccupancy } from "@/lib/booking-rules";

/**
 * Disponibilita' aggregata per un mese intero, per un singolo servizio: per
 * ogni giorno dice solo se e' completamente pieno/chiuso/senza slot per
 * questo servizio (`full`), usata dal calendario pubblico per desaturare i
 * giorni non prenotabili senza dover caricare tutti gli slot di ogni giorno.
 *
 * Query in batch (non un giro sequenziale di query per ogni singolo giorno):
 * un mese intero altrimenti richiede fino a ~31 round-trip al database,
 * abbastanza lento da lasciare il calendario cliccabile su giorni chiusi
 * mentre l'utente aspetta il risultato (vedi feedback utente: prenotazione
 * di venerdi' su un servizio chiuso il venerdi').
 */
export async function GET(request: NextRequest) {
  const monthParam = request.nextUrl.searchParams.get("month"); // "YYYY-MM"
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  if (!monthParam || !appointmentTypeId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const type = await prisma.appointmentType.findUnique({ where: { id: appointmentTypeId } });
  if (!type) {
    return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
  }

  const monthStart = startOfMonth(parseISO(`${monthParam}-01`));
  const monthEnd = endOfMonth(monthStart);
  const rangeStart = startOfDayInRome(monthStart);
  const rangeEndExclusive = startOfDayInRome(addDays(monthEnd, 1));

  const [exceptions, bands, overrides, bookings] = await Promise.all([
    prisma.scheduleException.findMany({
      where: { appointmentTypeId, date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
    prisma.scheduleBand.findMany({ where: { appointmentTypeId } }),
    prisma.slotOverride.findMany({
      where: { appointmentTypeId, date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
    prisma.booking.findMany({
      where: {
        appointmentTypeId,
        startTime: { gte: rangeStart, lt: rangeEndExclusive },
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { startTime: true, status: true },
    }),
  ]);

  const exceptionByDate = new Map(exceptions.map((e) => [dateIsoInRome(e.date), e]));

  const bandsByDayOfWeek = new Map<number, { startTime: string; endTime: string }[]>();
  for (const b of bands) {
    const list = bandsByDayOfWeek.get(b.dayOfWeek) ?? [];
    list.push({ startTime: b.startTime, endTime: b.endTime });
    bandsByDayOfWeek.set(b.dayOfWeek, list);
  }

  const overrideByKey = new Map(overrides.map((o) => [`${dateIsoInRome(o.date)}_${o.time}`, o]));

  // Stessa logica di conteggio di getSlotOccupancy (booking-rules.ts), solo
  // raggruppata per slot in un unico giro invece di una query per slot.
  const bookingsByStart = new Map<string, { status: string }[]>();
  for (const b of bookings) {
    const key = b.startTime.toISOString();
    const list = bookingsByStart.get(key) ?? [];
    list.push({ status: b.status });
    bookingsByStart.set(key, list);
  }

  const now = new Date();
  const days: { date: string; full: boolean }[] = [];

  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) {
    const dateIso = dateIsoInRome(d);
    const exception = exceptionByDate.get(dateIso);

    let activeBands: { startTime: string; endTime: string }[];
    if (exception) {
      activeBands =
        exception.isClosed || !exception.openTime || !exception.closeTime
          ? []
          : [{ startTime: exception.openTime, endTime: exception.closeTime }];
    } else {
      const dayOfWeek = new Date(`${dateIso}T12:00:00Z`).getUTCDay();
      activeBands = bandsByDayOfWeek.get(dayOfWeek) ?? [];
    }

    let full = true;
    const seenTimes = new Set<string>();
    for (const band of activeBands) {
      if (!full) break;
      let slotStart = romeWallTimeToInstant(dateIso, band.startTime);
      const bandEnd = romeWallTimeToInstant(dateIso, band.endTime);
      while (isBefore(slotStart, bandEnd)) {
        const time = toHHMM(slotStart);
        if (!seenTimes.has(time)) {
          seenTimes.add(time);
          if (!isBefore(slotStart, now)) {
            const override = overrideByKey.get(`${dateIso}_${time}`);
            const isDisabled = override?.isDisabled ?? false;
            const capacity = override?.capacity ?? type.capacity;
            if (!isDisabled && capacity > 0) {
              const occupancy = summarizeOccupancy(bookingsByStart.get(slotStart.toISOString()) ?? []);
              if (occupancy.total < capacity) {
                full = false;
                break;
              }
            }
          }
        }
        slotStart = addMinutes(slotStart, type.durationMinutes);
      }
    }

    days.push({ date: dateIso, full });
  }

  return NextResponse.json({ days });
}
