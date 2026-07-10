import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CLIENT_TOKEN_COOKIE, clientTokenCookieOptions } from "@/lib/client-token";

/**
 * Ritorna i dati contatto del cliente associato al cookie "ricordami", per
 * precompilare il form di prenotazione pubblico (l'utente puo' comunque
 * modificarli). Se il token non risolve piu' a nessun cliente (es. dati di
 * test ripuliti in dev, o cliente cancellato), il cookie viene rimosso
 * invece di restare a puntare a un record fantasma.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(CLIENT_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ client: null });
  }

  const client = await prisma.client.findUnique({
    where: { returningToken: token },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });

  if (!client) {
    const res = NextResponse.json({ client: null });
    res.cookies.set(CLIENT_TOKEN_COOKIE, "", { ...clientTokenCookieOptions(), maxAge: 0 });
    return res;
  }

  return NextResponse.json({ client });
}
