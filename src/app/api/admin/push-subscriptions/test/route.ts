import { NextResponse } from "next/server";
import { sendAdminPush } from "@/lib/push";

function keyPreview(key: string | undefined) {
  if (!key) return null;
  return key.length <= 20 ? key : `${key.slice(0, 10)}...${key.slice(-6)} (${key.length} caratteri)`;
}

/**
 * Invia una push di prova a tutti i dispositivi admin registrati, per
 * diagnosticare da Impostazioni dove si blocca. Include anche un'anteprima
 * della VAPID_PUBLIC_KEY letta lato server: va confrontata con quella che
 * il browser vede in NEXT_PUBLIC_VAPID_PUBLIC_KEY (mostrata nella pagina) -
 * se non coincidono e' il sintomo tipico di un "BadJwtToken" da Apple/web.push.
 */
export async function POST() {
  const result = await sendAdminPush({
    title: "Notifica di prova",
    body: "Se la vedi, le notifiche push funzionano su questo dispositivo.",
    url: "/admin/settings",
  });
  return NextResponse.json({ ...result, serverVapidPublicKeyPreview: keyPreview(process.env.VAPID_PUBLIC_KEY) });
}
