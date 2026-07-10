import { prisma } from "@/lib/db";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
  type BookingStatus,
} from "@/lib/constants";
import { getSlotOverride } from "@/lib/schedule";

/**
 * Regole di business del layer custom (Prompt Master sezioni 4 e 8):
 * queste enforcement NON sono coperte nativamente da Koalendar e vanno
 * applicate qui prima di confermare qualunque prenotazione creata dal
 * frontend custom, e riconciliate per le prenotazioni che arrivano via
 * webhook da Koalendar.
 */

export class BookingRuleError extends Error {
  code: "SLOT_FULL" | "DUPLICATE_TIMESLOT" | "SLOT_DISABLED" | "SLOT_PAST";
  constructor(code: "SLOT_FULL" | "DUPLICATE_TIMESLOT" | "SLOT_DISABLED" | "SLOT_PAST", message: string) {
    super(message);
    this.code = code;
  }
}

/** Capienza effettiva di uno slot: quella predefinita del tipo, salvo override puntuale. */
export async function getEffectiveCapacity(appointmentTypeId: string, startTime: Date, defaultCapacity: number) {
  const override = await getSlotOverride(appointmentTypeId, startTime);
  return { capacity: override?.capacity ?? defaultCapacity, isDisabled: override?.isDisabled ?? false };
}

export async function getSlotOccupancy(appointmentTypeId: string, startTime: Date) {
  const bookings = await prisma.booking.findMany({
    where: {
      appointmentTypeId,
      startTime,
      status: { in: ACTIVE_BOOKING_STATUSES },
    },
    select: { status: true },
  });

  return summarizeOccupancy(bookings);
}

function summarizeOccupancy(bookings: { status: string }[]) {
  const confirmed = bookings.filter((b) => b.status === BOOKING_STATUS.APPROVED || b.status === BOOKING_STATUS.RESCHEDULED).length;
  const pending = bookings.filter(
    (b) => b.status === BOOKING_STATUS.PENDING_APPROVAL || b.status === BOOKING_STATUS.RESCHEDULE_REQUESTED
  ).length;

  return { confirmed, pending, total: confirmed + pending };
}

/**
 * Occupancy di tutti gli slot di un giorno per un tipo di appuntamento, con
 * una sola query invece di una per slot (evita N+1 in /api/availability).
 */
export async function getDayOccupancyMap(appointmentTypeId: string, dayStart: Date, dayEnd: Date) {
  const bookings = await prisma.booking.findMany({
    where: {
      appointmentTypeId,
      startTime: { gte: dayStart, lt: dayEnd },
      status: { in: ACTIVE_BOOKING_STATUSES },
    },
    select: { startTime: true, status: true },
  });

  const byStart = new Map<number, { status: string }[]>();
  for (const b of bookings) {
    const key = b.startTime.getTime();
    const list = byStart.get(key);
    if (list) list.push(b);
    else byStart.set(key, [b]);
  }

  return (startTime: Date) => summarizeOccupancy(byStart.get(startTime.getTime()) ?? []);
}

/** Requisito: "una persona deve poter prenotare al massimo 1 slot nella stessa fascia oraria" */
export async function hasConflictingBooking(clientId: string, startTime: Date, excludeBookingId?: string) {
  const conflict = await prisma.booking.findFirst({
    where: {
      clientId,
      startTime,
      status: { in: ACTIVE_BOOKING_STATUSES },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
  return conflict !== null;
}

interface CreateBookingInput {
  clientId: string;
  appointmentTypeId: string;
  startTime: Date;
  endTime: Date;
  isRecurring?: boolean;
  recurrenceGroupId?: string;
  source?: string;
  notes?: string;
  /** L'admin puo' registrare un appuntamento gia' avvenuto (walk-in, riconciliazione); il booking pubblico no. */
  allowPast?: boolean;
}

/**
 * Crea una prenotazione applicando, in ordine:
 * 1. blocco duplicati utente/fascia oraria (gap custom);
 * 2. blocco capacita' massima slot (replica lato custom del limite nativo Koalendar);
 * poi assegna lo stato iniziale in base a "requiresApproval" sul tipo di appuntamento.
 */
export async function createCustomBooking(input: CreateBookingInput) {
  const appointmentType = await prisma.appointmentType.findUniqueOrThrow({
    where: { id: input.appointmentTypeId },
  });

  if (!input.allowPast && input.startTime.getTime() <= Date.now()) {
    throw new BookingRuleError("SLOT_PAST", "Questo slot e' gia' passato: scegli un orario futuro.");
  }

  const conflict = await hasConflictingBooking(input.clientId, input.startTime);
  if (conflict) {
    throw new BookingRuleError(
      "DUPLICATE_TIMESLOT",
      "Hai gia' una prenotazione attiva in questa fascia oraria."
    );
  }

  const { capacity, isDisabled } = await getEffectiveCapacity(
    input.appointmentTypeId,
    input.startTime,
    appointmentType.capacity
  );
  if (isDisabled) {
    throw new BookingRuleError("SLOT_DISABLED", "Questo slot non e' disponibile per la prenotazione.");
  }

  const occupancy = await getSlotOccupancy(input.appointmentTypeId, input.startTime);
  if (occupancy.total >= capacity) {
    throw new BookingRuleError("SLOT_FULL", "Questo slot ha raggiunto la capacita' massima.");
  }

  const initialStatus: BookingStatus = appointmentType.requiresApproval
    ? BOOKING_STATUS.PENDING_APPROVAL
    : BOOKING_STATUS.APPROVED;

  const booking = await prisma.booking.create({
    data: {
      clientId: input.clientId,
      appointmentTypeId: input.appointmentTypeId,
      startTime: input.startTime,
      endTime: input.endTime,
      isRecurring: input.isRecurring ?? false,
      recurrenceGroupId: input.recurrenceGroupId,
      source: input.source ?? "custom",
      notes: input.notes,
      status: initialStatus,
    },
    include: { client: true, appointmentType: true },
  });

  // Se il servizio non richiede approvazione, la prenotazione nasce gia' confermata:
  // l'email di conferma va inviata subito, la transizione via admin non avverra' mai.
  // IMPORTANTE: awaitate (non fire-and-forget) perche' su Vercel la funzione
  // serverless puo' congelarsi non appena la response e' partita, uccidendo
  // qualunque promise ancora in corso e facendo sparire email/push in silenzio.
  if (initialStatus === BOOKING_STATUS.APPROVED) {
    const { sendBookingConfirmationEmail } = await import("@/lib/mailer");
    await sendBookingConfirmationEmail(booking).catch((err) => console.error("[booking-rules] invio email fallito:", err));
  }

  // L'admin va avvisato per OGNI nuova prenotazione, non solo quelle da
  // approvare: cambia solo il testo/link della notifica.
  const { sendAdminPush } = await import("@/lib/push");
  await sendAdminPush(
    initialStatus === BOOKING_STATUS.APPROVED
      ? {
          title: "Nuova prenotazione confermata",
          body: `${booking.client.firstName} ${booking.client.lastName} - ${booking.appointmentType.name}`,
          url: "/admin",
        }
      : {
          title: "Nuova richiesta di prenotazione",
          body: `${booking.client.firstName} ${booking.client.lastName} - ${booking.appointmentType.name}`,
          url: "/admin?status=PENDING_APPROVAL",
        }
  ).catch((err) => console.error("[booking-rules] invio push fallito:", err));

  return booking;
}
