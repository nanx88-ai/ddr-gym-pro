import { NextRequest, NextResponse } from "next/server";
import { startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { sendPlainEmail } from "@/lib/mailer";

/**
 * Cron giornaliero (vedi vercel.json): per ogni scadenza non ancora
 * notificata, se oggi ha raggiunto la soglia di preavviso (dueDate -
 * notifyDaysBefore), avvisa via email sia l'admin che il cliente, poi segna
 * notifiedAt cosi' non viene rispedita nei giorni successivi. Fuori da
 * /api/admin apposta: Vercel Cron non ha il cookie di sessione, la route e'
 * protetta da CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
  }

  const today = startOfDay(new Date());

  const pending = await prisma.reminder.findMany({
    where: { notifiedAt: null },
    include: { client: true },
  });

  const admins = await prisma.adminUser.findMany({ select: { email: true } });

  let notified = 0;
  for (const reminder of pending) {
    const triggerDate = startOfDay(subDays(reminder.dueDate, reminder.notifyDaysBefore));
    if (today < triggerDate) continue;

    const daysLeft = Math.round((startOfDay(reminder.dueDate).getTime() - today.getTime()) / 86400000);
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

  return NextResponse.json({ checked: pending.length, notified });
}
