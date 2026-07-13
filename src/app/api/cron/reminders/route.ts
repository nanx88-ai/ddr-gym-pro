import { NextRequest, NextResponse } from "next/server";
import { addMonths, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { sendPlainEmail } from "@/lib/mailer";
import { sendAdminPush } from "@/lib/push";
import { startOfDayInRome } from "@/lib/timezone";

/**
 * Cron giornaliero (vedi vercel.json): per ogni scadenza non ancora
 * notificata, se oggi ha raggiunto la soglia di preavviso (dueDate -
 * notifyDaysBefore), avvisa via email sia l'admin che il cliente, poi segna
 * notifiedAt cosi' non viene rispedita nei giorni successivi. Fuori da
 * /api/admin apposta: Vercel Cron non ha il cookie di sessione, la route e'
 * protetta da CRON_SECRET.
 *
 * Gestisce anche gli abbonamenti (vedi processSubscriptions): rinnovo
 * automatico alla scadenza + promemoria di scadenza/rinnovo via email
 * (admin e cliente) e push (admin).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
  }

  const today = startOfDayInRome(new Date());

  const pending = await prisma.reminder.findMany({
    where: { notifiedAt: null },
    include: { client: true },
  });

  const admins = await prisma.adminUser.findMany({ select: { email: true } });

  let notified = 0;
  for (const reminder of pending) {
    const triggerDate = startOfDayInRome(subDays(reminder.dueDate, reminder.notifyDaysBefore));
    if (today < triggerDate) continue;

    const daysLeft = Math.round((startOfDayInRome(reminder.dueDate).getTime() - today.getTime()) / 86400000);
    const when = formatDate(reminder.dueDate.toISOString());
    const subject = `Scadenza tra ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}: ${reminder.title}`;
    const text = [
      `Scadenza: ${reminder.title}`,
      `Cliente: ${reminder.client.firstName} ${reminder.client.lastName}`,
      `Data: ${when}`,
      reminder.description ? `Note: ${reminder.description}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    for (const admin of admins) {
      await sendPlainEmail(admin.email, subject, text);
    }
    await sendPlainEmail(
      reminder.client.email,
      subject,
      `Ciao ${reminder.client.firstName},\n\nUn promemoria: "${reminder.title}" e' in scadenza il ${when}${
        reminder.description ? `.\n\n${reminder.description}` : "."
      }\n\nContattaci se hai bisogno di aiuto.`
    );

    await prisma.reminder.update({ where: { id: reminder.id }, data: { notifiedAt: new Date() } });
    notified++;
  }

  const subs = await processSubscriptions(today, admins.map((a) => a.email));

  return NextResponse.json({ checked: pending.length, notified, subscriptions: subs });
}

/**
 * Abbonamenti: prima il rollover dei rinnovi automatici scaduti (endDate
 * avanti di renewMonths, ripetuto finche' non supera oggi, cosi' un cron
 * rimasto fermo non lascia scadenze nel passato), poi i promemoria per le
 * scadenze entro la soglia di preavviso. notifiedForEnd memorizza per quale
 * endDate il promemoria e' gia' partito: dopo un rinnovo endDate cambia e
 * il promemoria successivo riparte da solo.
 */
async function processSubscriptions(today: Date, adminEmails: string[]) {
  let renewed = 0;
  const expired = await prisma.subscription.findMany({
    where: { autoRenew: true, endDate: { lt: today } },
  });
  for (const sub of expired) {
    let nextEnd = sub.endDate;
    while (startOfDayInRome(nextEnd) < today) nextEnd = addMonths(nextEnd, sub.renewMonths);
    await prisma.subscription.update({ where: { id: sub.id }, data: { endDate: nextEnd } });
    renewed++;
  }

  let notified = 0;
  const upcoming = await prisma.subscription.findMany({
    include: { client: true, tariff: true },
  });
  for (const sub of upcoming) {
    if (sub.notifiedForEnd && sub.notifiedForEnd.getTime() === sub.endDate.getTime()) continue;
    const triggerDate = startOfDayInRome(subDays(sub.endDate, sub.notifyDaysBefore));
    if (today < triggerDate) continue;

    const daysLeft = Math.max(0, Math.round((startOfDayInRome(sub.endDate).getTime() - today.getTime()) / 86400000));
    const when = formatDate(sub.endDate.toISOString());
    const clientName = `${sub.client.firstName} ${sub.client.lastName}`;
    const giorni = `${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}`;

    const adminSubject = sub.autoRenew
      ? `Rinnovo automatico tra ${giorni}: ${clientName} - ${sub.tariff.title}`
      : `Abbonamento in scadenza tra ${giorni}: ${clientName} - ${sub.tariff.title}`;
    const adminText = [
      `Cliente: ${clientName}`,
      `Abbonamento: ${sub.tariff.title}`,
      sub.autoRenew ? `Si rinnova automaticamente il ${when} (durata rinnovo: ${sub.renewMonths} mesi).` : `Scade il ${when} e NON si rinnova automaticamente.`,
    ].join("\n");

    for (const email of adminEmails) {
      await sendPlainEmail(email, adminSubject, adminText);
    }
    await sendAdminPush({
      title: adminSubject,
      body: adminText.replaceAll("\n", " · "),
      url: "/admin/subscriptions",
    });

    if (sub.client.email) {
      const clientSubject = sub.autoRenew
        ? `Il tuo abbonamento ${sub.tariff.title} si rinnova il ${when}`
        : `Il tuo abbonamento ${sub.tariff.title} scade il ${when}`;
      await sendPlainEmail(
        sub.client.email,
        clientSubject,
        `Ciao ${sub.client.firstName},\n\n${
          sub.autoRenew
            ? `il tuo abbonamento "${sub.tariff.title}" si rinnovera' automaticamente il ${when}.`
            : `il tuo abbonamento "${sub.tariff.title}" scadra' il ${when}. Contattaci per rinnovarlo.`
        }\n\nA presto!`
      );
    }

    await prisma.subscription.update({ where: { id: sub.id }, data: { notifiedForEnd: sub.endDate } });
    notified++;
  }

  return { renewed, notified };
}
