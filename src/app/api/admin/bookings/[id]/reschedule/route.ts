import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

/**
 * Modifica data/ora di una prenotazione dal pannello admin: come la
 * creazione manuale, nessun vincolo (retroattivo, slot pieno/disattivato
 * inclusi) - e' una decisione del trainer, non una richiesta self-service.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { startTime: new Date(parsed.data.startTime), endTime: new Date(parsed.data.endTime) },
    include: { client: true, appointmentType: true },
  });

  return NextResponse.json({ booking });
}
