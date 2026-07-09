import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BOOKING_STATUS, RESCHEDULE_STATUS } from "@/lib/constants";
import { hasConflictingBooking, getEffectiveCapacity, getSlotOccupancy } from "@/lib/booking-rules";

const bodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});

/** Coda di approvazione admin per gli spostamenti (Prompt Master sezione 7). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const rescheduleRequest = await prisma.rescheduleRequest.findUnique({
    where: { id },
    include: { booking: { include: { appointmentType: true } } },
  });
  if (!rescheduleRequest) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }
  if (rescheduleRequest.status !== RESCHEDULE_STATUS.PENDING) {
    return NextResponse.json({ error: "Richiesta gia' risolta" }, { status: 409 });
  }

  if (parsed.data.decision === "REJECT") {
    await prisma.rescheduleRequest.update({
      where: { id },
      data: { status: RESCHEDULE_STATUS.REJECTED, resolvedAt: new Date() },
    });
    await prisma.booking.update({
      where: { id: rescheduleRequest.bookingId },
      data: { status: BOOKING_STATUS.APPROVED },
    });
    return NextResponse.json({ ok: true });
  }

  const { booking } = rescheduleRequest;
  const conflict = await hasConflictingBooking(
    booking.clientId,
    rescheduleRequest.requestedStartTime,
    booking.id
  );
  if (conflict) {
    return NextResponse.json(
      { error: "Il cliente ha gia' un'altra prenotazione in quella fascia oraria." },
      { status: 409 }
    );
  }

  const { capacity, isDisabled } = await getEffectiveCapacity(
    booking.appointmentTypeId,
    rescheduleRequest.requestedStartTime,
    booking.appointmentType.capacity
  );
  if (isDisabled) {
    return NextResponse.json({ error: "Lo slot richiesto non e' disponibile." }, { status: 409 });
  }
  const occupancy = await getSlotOccupancy(booking.appointmentTypeId, rescheduleRequest.requestedStartTime);
  if (occupancy.total >= capacity) {
    return NextResponse.json({ error: "Lo slot richiesto e' pieno." }, { status: 409 });
  }

  await prisma.rescheduleRequest.update({
    where: { id },
    data: { status: RESCHEDULE_STATUS.APPROVED, resolvedAt: new Date() },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BOOKING_STATUS.RESCHEDULED,
      startTime: rescheduleRequest.requestedStartTime,
      endTime: rescheduleRequest.requestedEndTime,
    },
  });

  return NextResponse.json({ ok: true });
}
