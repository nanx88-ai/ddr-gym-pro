import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BOOKING_STATUS, RESCHEDULE_STATUS } from "@/lib/constants";

const bodySchema = z.object({
  requestedStartTime: z.string().min(1),
  requestedEndTime: z.string().min(1),
  reason: z.string().optional(),
});

/**
 * Richiesta di spostamento da parte del cliente, soggetta ad approvazione
 * admin esplicita (Prompt Master 3.3 punto 13 e 5.3: gap rispetto al
 * comportamento nativo osservato su Koalendar, dove la riprogrammazione
 * autonoma sembra avvenire senza una nuova approvazione).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  const rescheduleRequest = await prisma.rescheduleRequest.create({
    data: {
      bookingId: id,
      requestedStartTime: new Date(parsed.data.requestedStartTime),
      requestedEndTime: new Date(parsed.data.requestedEndTime),
      reason: parsed.data.reason,
      status: RESCHEDULE_STATUS.PENDING,
    },
  });

  await prisma.booking.update({
    where: { id },
    data: { status: BOOKING_STATUS.RESCHEDULE_REQUESTED },
  });

  return NextResponse.json({ rescheduleRequest });
}
