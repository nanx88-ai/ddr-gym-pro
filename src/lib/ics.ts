interface IcsBooking {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  notes: string | null;
  client: { firstName: string; lastName: string; email: string };
  appointmentType: { name: string };
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Genera un unico evento VEVENT per una prenotazione (usato per l'allegato email). */
export function buildIcsEvent(b: IcsBooking) {
  const summary = escapeText(`${b.appointmentType.name} - ${b.client.firstName} ${b.client.lastName}`);
  const description = escapeText(b.notes ?? "");
  return [
    "BEGIN:VEVENT",
    `UID:${b.id}@koalendar-palestra`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(b.startTime)}`,
    `DTEND:${formatIcsDate(b.endTime)}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : null,
    `STATUS:${b.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** Calendario ICS completo (feed sottoscrivibile da Google/Apple Calendar). */
export function buildIcsCalendar(bookings: IcsBooking[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Koalendar Palestra//Feed//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Palestra - Appuntamenti",
    ...bookings.map(buildIcsEvent),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Singolo evento .ics standalone (per l'allegato email al cliente). */
export function buildIcsFile(b: IcsBooking) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Koalendar Palestra//Booking//IT", "CALSCALE:GREGORIAN", buildIcsEvent(b), "END:VCALENDAR"].join(
    "\r\n"
  );
}
