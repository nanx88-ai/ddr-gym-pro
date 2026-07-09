import { addDays, isAfter, parseISO, setHours, setMinutes, startOfDay } from "date-fns";

const MAX_OCCURRENCES = 104; // ~2 anni a settimana, tetto di sicurezza

/**
 * Espande una regola ricorrente settimanale ("tutti i martedi' dal gg al gg
 * alle ore X") in una lista di date/ore concrete. dayOfWeek: 0 = Domenica.
 */
export function expandWeeklyOccurrences(
  dayOfWeek: number,
  startDateIso: string,
  endDateIso: string,
  time: string
): Date[] {
  const [h, m] = time.split(":").map(Number);
  const start = startOfDay(parseISO(startDateIso));
  const end = startOfDay(parseISO(endDateIso));
  if (isAfter(start, end)) return [];

  const diff = (dayOfWeek - start.getDay() + 7) % 7;
  let d = addDays(start, diff);

  const out: Date[] = [];
  while (!isAfter(d, end) && out.length < MAX_OCCURRENCES) {
    out.push(setMinutes(setHours(d, h), m));
    d = addDays(d, 7);
  }
  return out;
}

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
export const WEEKDAY_LABELS_FULL = [
  "domenica",
  "lunedi'",
  "martedi'",
  "mercoledi'",
  "giovedi'",
  "venerdi'",
  "sabato",
];

/** Data (iso, giorno) dell'ultima occorrenza se si ripete la stessa data ogni 7 giorni per `count` volte. */
export function occurrenceCountEndDate(startDateIso: string, count: number): string {
  const start = startOfDay(parseISO(startDateIso));
  const last = addDays(start, (Math.max(1, count) - 1) * 7);
  return toIsoDate(last);
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
