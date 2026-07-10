import webpush from "web-push";
import { prisma } from "@/lib/db";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY non impostate: nessuna push verra' inviata.");
    return;
  }
  webpush.setVapidDetails("mailto:admin@ddracademy.local", publicKey, privateKey);
  configured = true;
}

export interface SendPushResult {
  configured: boolean;
  subscriptions: number;
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Invia una notifica push a tutti i dispositivi admin registrati. Le
 * subscription scadute/revocate (410/404) vengono rimosse automaticamente;
 * il resto degli errori viene solo loggato, non deve bloccare il flusso
 * chiamante (es. creazione prenotazione). Ritorna un riepilogo usato anche
 * dall'endpoint di test per capire dove si e' bloccato l'invio.
 */
export async function sendAdminPush(payload: { title: string; body: string; url?: string }): Promise<SendPushResult> {
  ensureConfigured();
  if (!configured) {
    return { configured: false, subscriptions: 0, sent: 0, failed: 0, errors: ["VAPID non configurato sul server"] };
  }

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) {
    console.warn("[push] nessuna subscription registrata: nessun dispositivo attivera' notifiche.");
    return { configured: true, subscriptions: 0, sent: 0, failed: 0, errors: [] };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  const errors: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : null;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          errors.push(`Subscription ${sub.id} scaduta/revocata (${statusCode}), rimossa.`);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[push] invio fallito:", err);
          errors.push(`Subscription ${sub.id}: ${message}`);
        }
      }
    })
  );

  return { configured: true, subscriptions: subs.length, sent, failed: subs.length - sent, errors };
}
