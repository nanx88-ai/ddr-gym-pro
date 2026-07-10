"use client";

import { useEffect, useState } from "react";
import { btnNeutral, btnPrimary } from "@/lib/ui";
import { useToast } from "@/components/Toast";

type Status = "unsupported" | "denied" | "loading" | "off" | "on";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  let str = "";
  for (const b of new Uint8Array(buffer)) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Attiva/disattiva le notifiche push native su questo dispositivo (nuove
 * richieste di prenotazione/spostamento anche a PWA chiusa). Ogni
 * dispositivo ha una sua subscription indipendente: va attivata su ognuno
 * separatamente (telefono, desktop, ecc).
 */
export default function PushNotificationsToggle() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  // true se la subscription attuale del browser e' stata creata con una
  // chiave VAPID pubblica diversa da quella che il server usa oggi: causa
  // tipica del "BadJwtToken" 403 di Apple (la firma non corrisponde piu'
  // alla chiave con cui il dispositivo si e' iscritto).
  const [keyMismatch, setKeyMismatch] = useState(false);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");

      const currentKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (sub?.options.applicationServerKey && currentKey) {
        const subscribedKey = arrayBufferToBase64Url(sub.options.applicationServerKey);
        setKeyMismatch(subscribedKey !== currentKey);
      }
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Notifiche push non configurate sul server.");
        setStatus("off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch("/api/admin/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setStatus("on");
      setKeyMismatch(false);
      toast.success("Notifiche push attivate su questo dispositivo.");
    } catch {
      toast.error("Impossibile attivare le notifiche push.");
      setStatus("off");
    }
  }

  async function sendTest() {
    try {
      const res = await fetch("/api/admin/push-subscriptions/test", { method: "POST" });
      const json = await res.json();
      if (!json.configured) {
        toast.error("VAPID non configurato sul server (env var mancanti su Vercel).");
      } else if (json.subscriptions === 0) {
        toast.error("Nessun dispositivo registrato sul server: riattiva il toggle qui sopra.");
      } else if (json.sent > 0) {
        toast.success(`Push di prova inviata a ${json.sent}/${json.subscriptions} dispositivo/i. Controlla se e' arrivata.`);
      } else {
        toast.error(`Invio fallito su tutti i dispositivi: ${json.errors?.[0] ?? "errore sconosciuto"}`);
      }
    } catch {
      toast.error("Richiesta di test fallita.");
    }
  }

  async function reset() {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setKeyMismatch(false);
      setStatus("off");
      await enable();
    } catch {
      toast.error("Impossibile reimpostare le notifiche push.");
      setStatus("on");
    }
  }

  async function disable() {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      toast.success("Notifiche push disattivate su questo dispositivo.");
    } catch {
      toast.error("Impossibile disattivare le notifiche push.");
      setStatus("on");
    }
  }

  if (status === "unsupported") {
    return <p className="text-xs text-neutral-500 dark:text-neutral-400">Notifiche push non supportate su questo browser/dispositivo.</p>;
  }
  if (status === "denied") {
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Notifiche bloccate nelle impostazioni del browser/telefono per questo sito: riabilitale da li&apos; per attivarle.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          {status === "on" ? "Attive su questo dispositivo" : "Nuove richieste di prenotazione/spostamento"}
        </span>
        <button
          onClick={status === "on" ? disable : enable}
          disabled={status === "loading"}
          className={status === "on" ? btnNeutral : btnPrimary}
        >
          {status === "loading" ? "..." : status === "on" ? "Disattiva" : "Attiva"}
        </button>
        {status === "on" && !keyMismatch && (
          <button onClick={sendTest} className={btnNeutral}>
            Invia notifica di prova
          </button>
        )}
      </div>
      {status === "on" && keyMismatch && (
        <div className="mt-2 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-300">
          Questo dispositivo si era iscritto con una chiave diversa da quella attuale del server (es. dopo un
          redeploy con la chiave cambiata): le notifiche a questo dispositivo falliranno finche&apos; non lo
          reimposti.
          <button onClick={reset} className={`mt-2 block ${btnNeutral}`}>
            Reimposta su questo dispositivo
          </button>
        </div>
      )}
    </div>
  );
}
