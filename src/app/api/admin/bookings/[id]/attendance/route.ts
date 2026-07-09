import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ attended: z.boolean().nullable() });

/** Segna presenza/assenza effettiva su una prenotazione (storico presenze, base per la fatturazione per accessi). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { attended: parsed.data.attended, attendedAt: parsed.data.attended === null ? null : new Date() },
  });

  return NextResponse.json({ booking });
}
