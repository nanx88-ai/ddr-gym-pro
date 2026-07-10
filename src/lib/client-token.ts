import { randomBytes } from "crypto";

// Cookie "ricordami" per il booking pubblico: nessun account/password, solo
// un token opaco che permette di precompilare nome/email/telefono al giro
// successivo sullo stesso device. Va sempre trattato come dato non
// sensibile lato client (httpOnly, non leggibile da JS) e non sostituisce
// nessun controllo di autorizzazione lato server.
export const CLIENT_TOKEN_COOKIE = "koalendar_client_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 anno

export function generateClientToken(): string {
  return randomBytes(32).toString("hex");
}

export function clientTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
