import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/** Orario settimanale per tipo di appuntamento (Prompt Master 3.3 / 7). */
export async function GET(request: NextRequest) {
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  if (!appointmentTypeId) {
    return NextResponse.json({ error: "appointmentTypeId richiesto" }, { status: 400 });
  }

  const schedule = await prisma.weeklySchedule.findMany({
    where: { appointmentTypeId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ schedule });
}

const timeRegex = /^\d{2}:\d{2}$/;

const dayEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    openTime: z.string().regex(timeRegex),
    closeTime: z.string().regex(timeRegex),
    breakStart: z.string().regex(timeRegex).nullable().optional(),
    breakEnd: z.string().regex(timeRegex).nullable().optional(),
  })
  .refine((d) => (d.breakStart === null || d.breakStart === undefined) === (d.breakEnd === null || d.breakEnd === undefined), {
    message: "Indicare sia inizio che fine della pausa pranzo, o nessuno dei due.",
  });

const bodySchema = z.object({
  appointmentTypeId: z.string().min(1),
  days: z.array(dayEntrySchema).length(7),
});

/** Salva l'intero orario settimanale (7 giorni), inclusa la pausa pranzo ricorrente, per un tipo di appuntamento. */
export async function PUT(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const { appointmentTypeId, days } = parsed.data;

  if (days.some((d) => d.openTime >= d.closeTime)) {
    return NextResponse.json({ error: "L'orario di apertura deve precedere quello di chiusura." }, { status: 400 });
  }
  if (
    days.some(
      (d) => d.breakStart && d.breakEnd && (d.breakStart < d.openTime || d.breakEnd > d.closeTime || d.breakStart >= d.breakEnd)
    )
  ) {
    return NextResponse.json({ error: "La pausa pranzo deve rientrare nell'orario di apertura." }, { status: 400 });
  }

  await prisma.$transaction(
    days.map((day) =>
      prisma.weeklySchedule.upsert({
        where: { appointmentTypeId_dayOfWeek: { appointmentTypeId, dayOfWeek: day.dayOfWeek } },
        update: {
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
          breakStart: day.breakStart ?? null,
          breakEnd: day.breakEnd ?? null,
        },
        create: {
          appointmentTypeId,
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
          breakStart: day.breakStart ?? null,
          breakEnd: day.breakEnd ?? null,
        },
      })
    )
  );

  const schedule = await prisma.weeklySchedule.findMany({
    where: { appointmentTypeId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ schedule });
}
