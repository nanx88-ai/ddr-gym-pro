import { prisma } from "@/lib/db";
import { buildIcsFile } from "@/lib/ics";
import { formatDateTime } from "@/lib/format";

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  from?: string;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const integration = await prisma.integration.findFirst({ where: { type: "smtp", active: true } });
  if (!integration) return null;
  try {
    const config = JSON.parse(integration.config);
    if (!config.host || !config.user || !config.password) return null;
    return config;
  } catch {
    return null;
  }
}

/**
 * Invio email generico (usato per i reminder di scadenza, e riusabile per
 * altre notifiche future). Ritorna sent:false senza lanciare se l'SMTP non
 * e' configurato, cosi' il chiamante puo' loggare/continuare senza rompersi.
 */
export async function sendPlainEmail(to: string, subject: string, text: string) {
  const smtp = await getSmtpConfig();
  if (!smtp) {
    console.warn("[mailer] Nessuna integrazione SMTP attiva: email non inviata.", { to, subject });
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.password },
  });

  await transporter.sendMail({ from: smtp.from || smtp.user, to, subject, text });
  return { sent: true as const };
}

interface BookingForEmail {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  notes: string | null;
  client: { firstName: string; lastName: string; email: string };
  appointmentType: { name: string };
}

/**
 * Invia l'email di conferma con il riepilogo e l'allegato .ics al cliente
 * quando l'admin approva una prenotazione. Richiede un'integrazione SMTP
 * attiva in Impostazioni: se non c'e', non blocca l'approvazione, salta
 * solo l'invio (loggato lato server).
 */
export async function sendBookingConfirmationEmail(booking: BookingForEmail) {
  const smtp = await getSmtpConfig();
  if (!smtp) {
    console.warn("[mailer] Nessuna integrazione SMTP attiva: email di conferma non inviata.");
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.password },
  });

  const ics = buildIcsFile(booking);
  const when = formatDateTime(booking.startTime.toISOString());

  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to: booking.client.email,
    subject: `Prenotazione confermata: ${booking.appointmentType.name}`,
    text: `Ciao ${booking.client.firstName},\n\nLa tua prenotazione e' confermata.\n\nServizio: ${booking.appointmentType.name}\nQuando: ${when}\n${booking.notes ? `Note: ${booking.notes}\n` : ""}\nIn allegato trovi il file per aggiungere l'appuntamento al tuo calendario.\n\nA presto!`,
    icalEvent: { filename: "appuntamento.ics", method: "PUBLISH", content: ics },
  });

  return { sent: true as const };
}
