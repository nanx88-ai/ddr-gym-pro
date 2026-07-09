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
  code: "SLOT_FULL" | "DUPLICATE_TIMESLOT" | "SLOT_DISABLED";
  constructor(code: "SLOT_FULL" | "DUPLICATE_TIMESLOT" | "SLOT_DISABLED", message: string) {
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

  const confirmed = bookings.filter((b) => b.status === BOOKING_STATUS.APPROVED || b.status === BOOKING_STATUS.RESCHEDULED).length;
  const pending = bookings.filter(
    (b) => b.status === BOOKING_STATUS.PENDING_APPROVAL || b.status === BOOKING_STATUS.RESCHEDULE_REQUESTED
  ).length;

  return { confirmed, pending, total: confirmed + pending };
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

  return prisma.booking.create({
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
}
