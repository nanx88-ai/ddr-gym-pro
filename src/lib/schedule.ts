import { prisma } from "@/lib/db";
import { addMinutes, isBefore, setHours, setMinutes, startOfDay } from "date-fns";

export interface OpenWindow {
  isOpen: boolean;
  openTime: string | null; // "HH:mm"
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  note: string | null;
}

/**
 * Determina se un tipo di appuntamento e' aperto in una data e con quale
 * orario/pausa pranzo, applicando prima le eccezioni puntuali (pause/chiusure
 * straordinarie/orari diversi) e poi l'orario settimanale ricorrente
 * (Prompt Master 3.3 e 7).
 */
export async function getOpenWindow(appointmentTypeId: string, date: Date): Promise<OpenWindow> {
  const day = startOfDay(date);

  const exception = await prisma.scheduleException.findUnique({
    where: { appointmentTypeId_date: { appointmentTypeId, date: day } },
  });

  const weekly = await prisma.weeklySchedule.findUnique({
    where: { appointmentTypeId_dayOfWeek: { appointmentTypeId, dayOfWeek: day.getDay() } },
  });

  if (exception) {
    if (exception.isClosed) {
      return { isOpen: false, openTime: null, closeTime: null, breakStart: null, breakEnd: null, note: exception.note };
    }
    return {
      isOpen: true,
      openTime: exception.openTime,
      closeTime: exception.closeTime,
      breakStart: exception.breakStart ?? weekly?.breakStart ?? null,
      breakEnd: exception.breakEnd ?? weekly?.breakEnd ?? null,
      note: exception.note,
    };
  }

  if (!weekly || !weekly.isOpen) {
    return { isOpen: false, openTime: null, closeTime: null, breakStart: null, breakEnd: null, note: null };
  }

  return {
    isOpen: true,
    openTime: weekly.openTime,
    closeTime: weekly.closeTime,
    breakStart: weekly.breakStart,
    breakEnd: weekly.breakEnd,
    note: null,
  };
}

function timeOnDay(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return setMinutes(setHours(day, h), m);
}

export function toHHMM(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Override puntuale (disattivazione o capienza diversa) per un preciso slot data+ora. */
export async function getSlotOverride(appointmentTypeId: string, startTime: Date) {
  const day = startOfDay(startTime);
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
}

/**
 * Genera tutti gli slot "grezzi" di un giorno per un tipo di appuntamento,
 * applicando orario, pausa pranzo e override puntuali per singolo slot
 * (disattivazione o capienza diversa dal default). Include anche gli slot
 * disattivati: chi consuma questa funzione decide se filtrarli (frontend
 * pubblico) o mostrarli per poterli riattivare (calendario admin).
 */
export async function generateDaySlots(appointmentTypeId: string, date: Date) {
  const day = startOfDay(date);
  const type = await prisma.appointmentType.findUniqueOrThrow({ where: { id: appointmentTypeId } });
  const window = await getOpenWindow(appointmentTypeId, day);

  const slots: GeneratedSlot[] = [];
  if (!window.isOpen || !window.openTime || !window.closeTime) {
    return { type, window, slots };
  }

  const overrides = await prisma.slotOverride.findMany({ where: { appointmentTypeId, date: day } });
  const overrideByTime = new Map(overrides.map((o) => [o.time, o]));

  const breakStart = window.breakStart ? timeOnDay(day, window.breakStart) : null;
  const breakEnd = window.breakEnd ? timeOnDay(day, window.breakEnd) : null;

  let slotStart = timeOnDay(day, window.openTime);
  const dayClose = timeOnDay(day, window.closeTime);

  while (isBefore(slotStart, dayClose)) {
    const slotEnd = addMinutes(slotStart, type.durationMinutes);
    const overlapsBreak = breakStart && breakEnd && isBefore(slotStart, breakEnd) && isBefore(breakStart, slotEnd);

    if (!overlapsBreak) {
      const time = toHHMM(slotStart);
      const override = overrideByTime.get(time);
      slots.push({
        time,
        startTime: slotStart,
        endTime: slotEnd,
        defaultCapacity: type.capacity,
        capacity: override?.capacity ?? type.capacity,
        isDisabled: override?.isDisabled ?? false,
        overrideId: override?.id ?? null,
      });
    }

    slotStart = addMinutes(slotStart, type.durationMinutes);
  }

  return { type, window, slots };
}
