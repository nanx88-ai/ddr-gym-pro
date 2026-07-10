import webpush from "web-push";
import { prisma } from "@/lib/db";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails("mailto:admin@ddracademy.local", publicKey, privateKey);
  configured = true;
}

/**
 * Invia una notifica push a tutti i dispositivi admin registrati. Le
 * subscription scadute/revocate (410/404) vengono rimosse automaticamente;
 * il resto degli errori viene solo loggato, non deve bloccare il flusso
 * chiamante (es. creazione prenotazione).
 */
export async function sendAdminPush(payload: { title: string; body: string; url?: string }) {
  ensureConfigured();
  if (!configured) return;

  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: unknown) {
        const statusCode = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : null;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] invio fallito:", err);
        }
      }
    })
  );
}
