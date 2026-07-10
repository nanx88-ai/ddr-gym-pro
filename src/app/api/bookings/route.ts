import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BookingRuleError, createCustomBooking } from "@/lib/booking-rules";
import { CLIENT_TOKEN_COOKIE, clientTokenCookieOptions, generateClientToken } from "@/lib/client-token";

const itemSchema = z.object({
  appointmentTypeId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  isRecurring: z.boolean().optional(),
  recurrenceGroupId: z.string().optional(),
});

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email non valida"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1).max(60),
});

/**
 * Creazione prenotazioni dal frontend cliente custom, con enforcement
 * pre-conferma delle regole di capacita' e "1 utente = 1 slot/fascia oraria"
 * (Prompt Master sezione 5.3). Accetta piu' `items` in un'unica richiesta
 * per supportare la selezione di slot multipli e le serie ricorrenti (es.
 * "tutti i martedi' dal gg al gg alle ore X"): ogni item viene validato e
 * creato indipendentemente, cosi' uno slot pieno non blocca gli altri.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.path[0] === "items" && i.code === "too_big");
    if (tooMany) {
      return NextResponse.json(
        { error: "Richiesta troppo estesa (max 1 anno di prenotazioni ricorrenti). Per esigenze diverse, contatta il responsabile." },
        { status: 400 }
      );
    }
    const badEmail = parsed.error.issues.some((i) => i.path[0] === "email");
    if (badEmail) {
      return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
    }
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const client = await prisma.client.upsert({
    where: { email: data.email },
    update: { firstName: data.firstName, lastName: data.lastName, phone: data.phone },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    },
  });

  // Cookie "ricordami" (nessun account): se il cliente non ha ancora un
  // token lo generiamo ora, cosi' al prossimo giro sullo stesso device i
  // suoi dati vengono precompilati.
  let returningToken = client.returningToken;
  if (!returningToken) {
    returningToken = generateClientToken();
    await prisma.client.update({ where: { id: client.id }, data: { returningToken } });
  }

  if (client.status === "PAUSED") {
    return NextResponse.json(
      { error: "Il tuo account risulta in pausa. Contatta la palestra per riattivarlo." },
      { status: 403 }
    );
  }
  if (client.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Il tuo account risulta archiviato. Contatta la palestra per riattivarlo." },
      { status: 403 }
    );
  }

  const bookings = [];
  const errors: { index: number; startTime: string; error: string; code?: string }[] = [];

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    try {
      const booking = await createCustomBooking({
        clientId: client.id,
        appointmentTypeId: item.appointmentTypeId,
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime),
        notes: data.notes,
        isRecurring: item.isRecurring,
        recurrenceGroupId: item.recurrenceGroupId,
        source: "custom",
      });
      bookings.push(booking);
    } catch (err) {
      if (err instanceof BookingRuleError) {
        errors.push({ index: i, startTime: item.startTime, error: err.message, code: err.code });
      } else {
        errors.push({ index: i, startTime: item.startTime, error: "Errore durante la creazione della prenotazione" });
      }
    }
  }

  if (bookings.length === 0) {
    const res = NextResponse.json({ error: "Nessuna prenotazione creata", errors }, { status: 409 });
    res.cookies.set(CLIENT_TOKEN_COOKIE, returningToken, clientTokenCookieOptions());
    return res;
  }

  const res = NextResponse.json({ bookings, errors });
  res.cookies.set(CLIENT_TOKEN_COOKIE, returningToken, clientTokenCookieOptions());
  return res;
}
