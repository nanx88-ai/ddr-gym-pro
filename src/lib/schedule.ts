import { prisma } from "@/lib/db";
import { addMinutes, isBefore } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { dateIsoInRome, GYM_TIMEZONE, romeWallTimeToInstant, startOfDayInRome } from "@/lib/timezone";

export interface DayBand {
  startTime: string; // "HH:mm"
  endTime: string;
}

export interface OpenWindow {
  isOpen: boolean;
  bands: DayBand[];
  note: string | null;
}

/**
 * Determina se un tipo di appuntamento e' aperto in una data e con quali
 * fasce orarie attive, applicando prima le eccezioni puntuali (chiusure
 * straordinarie/orario diverso per quel giorno) e poi le fasce settimanali
 * ricorrenti (Prompt Master 3.3 e 7). Niente "pausa pranzo" come concetto a
 * parte: sono semplicemente fasce diverse, i buchi tra loro non sono
 * prenotabili.
 */
export async function getOpenWindow(appointmentTypeId: string, date: Date): Promise<OpenWindow> {
  const day = startOfDayInRome(date);
  // Giorno della settimana secondo il calendario di Roma, non quello (UTC)
  // del server: altrimenti vicino alla mezzanotte si rischia di leggere
  // le fasce del giorno sbagliato.
  const dayOfWeek = new Date(`${dateIsoInRome(date)}T12:00:00Z`).getUTCDay();

  const exception = await prisma.scheduleException.findUnique({
    where: { appointmentTypeId_date: { appointmentTypeId, date: day } },
  });

  if (exception) {
    if (exception.isClosed) {
      return { isOpen: false, bands: [], note: exception.note };
    }
    if (!exception.openTime || !exception.closeTime) {
      return { isOpen: false, bands: [], note: exception.note };
    }
    return {
      isOpen: true,
      bands: [{ startTime: exception.openTime, endTime: exception.closeTime }],
      note: exception.note,
    };
  }

  const bands = await prisma.scheduleBand.findMany({
    where: { appointmentTypeId, dayOfWeek },
    orderBy: { startTime: "asc" },
  });

  return {
    isOpen: bands.length > 0,
    bands: bands.map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
    note: null,
  };
}

function timeOnDay(day: Date, hhmm: string) {
  return romeWallTimeToInstant(dateIsoInRome(day), hhmm);
}

export function toHHMM(date: Date) {
  return formatInTimeZone(date, GYM_TIMEZONE, "HH:mm");
}

/** Override puntuale (disattivazione o capienza diversa) per un preciso slot data+ora. */
export async function getSlotOverride(appointmentTypeId: string, startTime: Date) {
  const day = startOfDayInRome(startTime);
  const time = toHHMM(startTime);
  return prisma.slotOverride.findUnique({
    where: { appointmentTypeId_date_time: { appointmentTypeId, date: day, time } },
  });
}

export interface GeneratedSlot {
  time: string; // "HH:mm"
  startTime: Date;
  endTime: Date;
  defaultCapacity: number;
  capacity: number; // dopo eventuale override
  isDisabled: boolean;
  overrideId: string | null;
  isPast: boolean; // startTime gia' trascorso rispetto ad ora (istante reale, non serve il fuso: vedi src/lib/timezone.ts)
}

/**
 * Genera tutti gli slot "grezzi" di un giorno per un tipo di appuntamento,
 * applicando le fasce orarie attive e gli override puntuali per singolo slot
 * (disattivazione o capienza diversa dal default). Include anche gli slot
 * disattivati: chi consuma questa funzione decide se filtrarli (frontend
 * pubblico) o mostrarli per poterli riattivare (calendario admin).
 */
export async function generateDaySlots(appointmentTypeId: string, date: Date) {
  const day = startOfDayInRome(date);
  const type = await prisma.appointmentType.findUniqueOrThrow({ where: { id: appointmentTypeId } });
  const window = await getOpenWindow(appointmentTypeId, day);

  const slots: GeneratedSlot[] = [];
  if (!window.isOpen || window.bands.length === 0) {
    return { type, window, slots };
  }

  const overrides = await prisma.slotOverride.findMany({ where: { appointmentTypeId, date: day } });
  const overrideByTime = new Map(overrides.map((o) => [o.time, o]));
  const seenTimes = new Set<string>();

  for (const band of window.bands) {
    let slotStart = timeOnDay(day, band.startTime);
    const bandEnd = timeOnDay(day, band.endTime);

    while (isBefore(slotStart, bandEnd)) {
      const slotEnd = addMinutes(slotStart, type.durationMinutes);
      const time = toHHMM(slotStart);

      // Se due fasce si sovrappongono per errore di configurazione, non
      // duplicare lo stesso slot.
      if (!seenTimes.has(time)) {
        seenTimes.add(time);
        const override = overrideByTime.get(time);
        slots.push({
          time,
          startTime: slotStart,
          endTime: slotEnd,
          defaultCapacity: type.capacity,
          capacity: override?.capacity ?? type.capacity,
          isDisabled: override?.isDisabled ?? false,
          overrideId: override?.id ?? null,
          isPast: isBefore(slotStart, new Date()),
        });
      }

      slotStart = addMinutes(slotStart, type.durationMinutes);
    }
  }

  slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return { type, window, slots };
}
