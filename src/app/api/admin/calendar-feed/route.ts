import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const NAME = "admin-feed";

/**
 * Genera (se non esiste) e restituisce l'URL del feed calendario pubblico,
 * protetto da token, da sottoscrivere in Google Calendar ("Da URL") o Apple
 * Calendar ("Nuovo abbonamento calendario"). Nessun OAuth richiesto: e' una
 * sottoscrizione a sola lettura, aggiornata periodicamente dall'app calendario.
 */
export async function GET(request: Request) {
  let integration = await prisma.integration.findFirst({ where: { type: "calendar_feed", name: NAME } });

  if (!integration) {
    const token = randomBytes(24).toString("hex");
    integration = await prisma.integration.create({
      data: { type: "calendar_feed", name: NAME, config: JSON.stringify({ token }) },
    });
  }

  const { token } = JSON.parse(integration.config) as { token: string };
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    httpsUrl: `${origin}/api/calendar/feed.ics?token=${token}`,
    webcalUrl: `webcal://${origin.replace(/^https?:\/\//, "")}/api/calendar/feed.ics?token=${token}`,
  });
}

/** Rigenera il token (invalida l'URL precedente). */
export async function POST() {
  const token = randomBytes(24).toString("hex");
  await prisma.integration.upsert({
    where: { type_name: { type: "calendar_feed", name: NAME } },
    update: { config: JSON.stringify({ token }) },
    create: { type: "calendar_feed", name: NAME, config: JSON.stringify({ token }) },
  });
  return NextResponse.json({ ok: true });
}
