import { NextResponse } from "next/server";
import { sendAdminPush } from "@/lib/push";

/** Invia una push di prova a tutti i dispositivi admin registrati, per diagnosticare da Impostazioni dove si blocca. */
export async function POST() {
  const result = await sendAdminPush({
    title: "Notifica di prova",
    body: "Se la vedi, le notifiche push funzionano su questo dispositivo.",
    url: "/admin/settings",
  });
  return NextResponse.json(result);
}
