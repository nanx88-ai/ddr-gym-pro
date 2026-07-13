import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendHtmlBroadcast } from "@/lib/mailer";

export async function GET() {
  const items = await prisma.emailBroadcast.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ items });
}

const bodySchema = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  audience: z.enum(["ALL", "ACTIVE", "SELECTED"]),
  clientIds: z.array(z.string()).optional(), // solo per SELECTED
});

/**
 * Invia una comunicazione email all'audience scelta: tutti gli iscritti,
 * solo gli attivi, oppure una selezione manuale di clienti. Gli indirizzi
 * vengono risolti al momento dell'invio e salvati nello storico. Se l'SMTP
 * non e' configurato risponde 409 senza salvare nulla.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }
  const { subject, bodyHtml, audience, clientIds } = parsed.data;

  if (audience === "SELECTED" && (!clientIds || clientIds.length === 0)) {
    return NextResponse.json({ error: "Seleziona almeno un destinatario." }, { status: 400 });
  }

  const clients = await prisma.client.findMany({
    where:
      audience === "ALL"
        ? {}
        : audience === "ACTIVE"
          ? { status: "ACTIVE" }
          : { id: { in: clientIds } },
    select: { email: true },
  });
  const recipients = [...new Set(clients.map((c) => c.email).filter(Boolean))];

  if (recipients.length === 0) {
    return NextResponse.json({ error: "Nessun destinatario trovato per questa selezione." }, { status: 400 });
  }

  const result = await sendHtmlBroadcast(recipients, subject, bodyHtml);
  if ("reason" in result && result.reason === "smtp_not_configured") {
    return NextResponse.json(
      { error: "SMTP non configurato: aggiungi un'integrazione SMTP attiva in Impostazioni prima di inviare." },
      { status: 409 }
    );
  }

  const broadcast = await prisma.emailBroadcast.create({
    data: {
      subject,
      bodyHtml,
      audience,
      recipients: JSON.stringify(recipients),
      sentCount: result.sent,
      failedCount: result.failed,
    },
  });

  return NextResponse.json({ broadcast, sent: result.sent, failed: result.failed });
}
