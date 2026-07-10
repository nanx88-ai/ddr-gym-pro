import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Il server (Vercel) gira in UTC, non a Roma: costruire orari con
 * `setHours`/`setMinutes` o `new Date(y,m,d,h,m)` li interpreta nel fuso
 * orario del PROCESSO, non in quello della palestra, sfasando ogni slot di
 * 1-2 ore (CET/CEST) rispetto a quanto configurato. Queste funzioni fissano
 * sempre l'orario "a muro" di Roma, indipendentemente da dove gira il codice.
 */
export const GYM_TIMEZONE = "Europe/Rome";

/** Istante reale (UTC) corrispondente a `hh:mm` del giorno `dateIso` (YYYY-MM-DD), ora locale di Roma. */
export function romeWallTimeToInstant(dateIso: string, hhmm: string): Date {
  return fromZonedTime(`${dateIso}T${hhmm}:00`, GYM_TIMEZONE);
}

/** Data (YYYY-MM-DD) del giorno a cui appartiene `date`, secondo l'ora locale di Roma. */
export function dateIsoInRome(date: Date): string {
  return formatInTimeZone(date, GYM_TIMEZONE, "yyyy-MM-dd");
}

/** Data (YYYY-MM-DD) di oggi secondo l'ora locale di Roma. */
export function todayIsoInRome(): string {
  return dateIsoInRome(new Date());
}

/** Istante corrispondente alla mezzanotte (inizio giornata) di Roma per `date`. */
export function startOfDayInRome(date: Date): Date {
  return romeWallTimeToInstant(dateIsoInRome(date), "00:00");
}
