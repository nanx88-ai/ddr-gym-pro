import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/** Fasce orarie settimanali per tipo di appuntamento (Prompt Master 3.3 / 7). */
export async function GET(request: NextRequest) {
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  if (!appointmentTypeId) {
    return NextResponse.json({ error: "appointmentTypeId richiesto" }, { status: 400 });
  }

  const bands = await prisma.scheduleBand.findMany({
    where: { appointmentTypeId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ bands });
}

const timeRegex = /^\d{2}:\d{2}$/;

const bandSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
  })
  .refine((b) => b.startTime < b.endTime, { message: "L'inizio della fascia deve precedere la fine." });

const bodySchema = z.object({
  appointmentTypeId: z.string().min(1),
  bands: z.array(bandSchema),
});

/**
 * Sostituisce l'intero set di fasce orarie settimanali di un tipo di
 * appuntamento: l'admin puo' avere quante fasce vuole per ogni giorno (es.
 * 06:00-08:00, 09:00-11:00, 13:00-16:00), un giorno senza fasce e' chiuso.
 */
export async function PUT(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const { appointmentTypeId, bands } = parsed.data;

  // Fasce sovrapposte nello stesso giorno sono quasi certamente un errore di
  // battitura piuttosto che intenzionali: meglio bloccare e far correggere.
  const byDay = new Map<number, typeof bands>();
  for (const b of bands) byDay.set(b.dayOfWeek, [...(byDay.get(b.dayOfWeek) ?? []), b]);
  for (const dayBands of byDay.values()) {
    const sorted = [...dayBands].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        return NextResponse.json({ error: "Due fasce dello stesso giorno si sovrappongono." }, { status: 400 });
      }
    }
  }

  await prisma.$transaction([
    prisma.scheduleBand.deleteMany({ where: { appointmentTypeId } }),
    prisma.scheduleBand.createMany({
      data: bands.map((b) => ({
        appointmentTypeId,
        dayOfWeek: b.dayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    }),
  ]);

  const saved = await prisma.scheduleBand.findMany({
    where: { appointmentTypeId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ bands: saved });
}
