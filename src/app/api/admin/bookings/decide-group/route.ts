import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BOOKING_STATUS } from "@/lib/constants";
import { sendBookingConfirmationEmail } from "@/lib/mailer";

const bodySchema = z.object({
  bookingIds: z.array(z.string().min(1)).min(1).max(60),
  status: z.enum([BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED]),
});

/**
 * Approva/rifiuta in blocco tutte le occorrenze di una serie ricorrente
 * (stesso recurrenceGroupId), cosi' l'admin decide una volta sola invece di
 * dover confermare ogni singola data della serie dal pannello notifiche.
 */
export async function PATCH(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { bookingIds, status } = parsed.data;

  await prisma.booking.updateMany({
    where: { id: { in: bookingIds }, status: BOOKING_STATUS.PENDING_APPROVAL },
    data: { status },
  });

  if (status === BOOKING_STATUS.APPROVED) {
    const bookings = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      include: { client: true, appointmentType: true },
    });
    for (const booking of bookings) {
      await sendBookingConfirmationEmail(booking).catch((err) => console.error("[bookings] invio email fallito:", err));
    }
  }

  return NextResponse.json({ ok: true });
}
