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

async function createTransporter(smtp: SmtpConfig) {
  const nodemailer = await import("nodemailer");
  return nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.password },
  });
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

  const transporter = await createTransporter(smtp);
  await transporter.sendMail({ from: smtp.from || smtp.user, to, subject, text });
  return { sent: true as const };
}

/**
 * Invio email HTML a piu' destinatari, uno alla volta (niente cc/bcc: ogni
 * cliente riceve la propria copia senza vedere gli indirizzi degli altri).
 * Usato dalla bacheca Comunicazioni. Se l'SMTP non e' configurato non tenta
 * nulla e segnala il motivo al chiamante.
 */
export async function sendHtmlBroadcast(recipients: string[], subject: string, html: string) {
  const smtp = await getSmtpConfig();
  if (!smtp) {
    console.warn("[mailer] Nessuna integrazione SMTP attiva: broadcast non inviato.", { subject });
    return { sent: 0, failed: recipients.length, reason: "smtp_not_configured" as const };
  }

  const transporter = await createTransporter(smtp);
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      await transporter.sendMail({ from: smtp.from || smtp.user, to, subject, html });
      sent++;
    } catch (err) {
      console.error("[mailer] Invio fallito", { to, err });
      failed++;
    }
  }
  return { sent, failed };
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

/**
 * Riepilogo via email di una o piu' prenotazioni create manualmente
 * dall'admin (wizard "Nuova prenotazione"): una copia al cliente, una per
 * ogni admin. A differenza di sendBookingConfirmationEmail (che accompagna
 * l'approvazione di una singola prenotazione pubblica con allegato .ics),
 * qui l'elenco puo' contenere piu' date/orari (ricorrenze) e serve solo come
 * promemoria testuale, senza allegato calendario. Se l'SMTP non e'
 * configurato non blocca la creazione, salta solo l'invio (loggato).
 */
export async function sendAdminCreatedBookingSummaryEmail(params: {
  client: { firstName: string; lastName: string; email: string };
  appointmentTypeName: string;
  notes?: string | null;
  occurrences: { startTime: Date; endTime: Date }[];
}) {
  const smtp = await getSmtpConfig();
  if (!smtp) {
    console.warn("[mailer] Nessuna integrazione SMTP attiva: riepilogo prenotazione non inviato.");
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  const { client, appointmentTypeName, notes, occurrences } = params;
  const admins = await prisma.adminUser.findMany({ select: { email: true } });

  const whenList = occurrences.map((o) => `- ${formatDateTime(o.startTime.toISOString())}`).join("\n");
  const multi = occurrences.length > 1;

  const clientText = [
    `Ciao ${client.firstName},`,
    "",
    `La tua prenotazione e' stata registrata dallo staff.`,
    "",
    `Servizio: ${appointmentTypeName}`,
    multi ? `Date:\n${whenList}` : `Quando: ${whenList.replace(/^- /, "")}`,
    notes ? `Note: ${notes}` : "",
    "",
    "A presto!",
  ]
    .filter(Boolean)
    .join("\n");

  const adminText = [
    `Nuova prenotazione registrata da un admin.`,
    "",
    `Cliente: ${client.firstName} ${client.lastName} (${client.email})`,
    `Servizio: ${appointmentTypeName}`,
    multi ? `Date:\n${whenList}` : `Quando: ${whenList.replace(/^- /, "")}`,
    notes ? `Note: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const transporter = await createTransporter(smtp);
  const subject = `Prenotazione registrata: ${appointmentTypeName}`;

  await transporter.sendMail({ from: smtp.from || smtp.user, to: client.email, subject, text: clientText });
  for (const admin of admins) {
    await transporter.sendMail({ from: smtp.from || smtp.user, to: admin.email, subject, text: adminText });
  }

  return { sent: true as const };
}
