import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startOfDay } from "date-fns";

/**
 * Override di un singolo slot in una data specifica: disattivazione
 * ("mercoledi' 11 disattiva lo slot delle 10 e quello delle 16") o capienza
 * diversa dal default ("il 20 luglio alle 18 un solo posto disponibile").
 */
const bodySchema = z.object({
  appointmentTypeId: z.string().min(1),
  date: z.string().min(1),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  isDisabled: z.boolean(),
  capacity: z.number().int().min(0).max(500).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const { appointmentTypeId, date, time, isDisabled, capacity } = parsed.data;
  const day = startOfDay(new Date(date));

  const override = await prisma.slotOverride.upsert({
    where: { appointmentTypeId_date_time: { appointmentTypeId, date: day, time } },
    update: { isDisabled, capacity: capacity ?? null },
    create: { appointmentTypeId, date: day, time, isDisabled, capacity: capacity ?? null },
  });

  return NextResponse.json({ override });
}
