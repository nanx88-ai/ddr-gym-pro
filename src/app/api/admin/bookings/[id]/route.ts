import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BOOKING_STATUS } from "@/lib/constants";

const bodySchema = z.object({
  status: z.enum([
    BOOKING_STATUS.PENDING_APPROVAL,
    BOOKING_STATUS.APPROVED,
    BOOKING_STATUS.REJECTED,
    BOOKING_STATUS.CANCELLED,
  ]),
});

/** Approvazione / rifiuto / cancellazione di una prenotazione (Prompt Master 3.3). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { client: true, appointmentType: true },
  });

  return NextResponse.json({ booking });
}
