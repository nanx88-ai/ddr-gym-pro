import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startOfDayInRome } from "@/lib/timezone";

/**
 * Eccezioni al calendario standard: chiusure straordinarie/pause o orari
 * diversi per una data specifica (Prompt Master 3.3: "inserire pause",
 * "disattivare giorni specifici"; Koalendar audit: "Override per date
 * specifiche", "Aggiungi pausa").
 */
export async function GET(request: NextRequest) {
  const appointmentTypeId = request.nextUrl.searchParams.get("appointmentTypeId");
  if (!appointmentTypeId) {
    return NextResponse.json({ error: "appointmentTypeId richiesto" }, { status: 400 });
  }

  const exceptions = await prisma.scheduleException.findMany({
    where: { appointmentTypeId, date: { gte: startOfDayInRome(new Date()) } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ exceptions });
}

const bodySchema = z.object({
  appointmentTypeId: z.string().min(1),
  date: z.string().min(1),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const { appointmentTypeId, date, isClosed, openTime, closeTime, note } = parsed.data;

  if (!isClosed && (!openTime || !closeTime)) {
    return NextResponse.json(
      { error: "Per un orario personalizzato indicare sia apertura che chiusura." },
      { status: 400 }
    );
  }

  const exception = await prisma.scheduleException.upsert({
    where: { appointmentTypeId_date: { appointmentTypeId, date: startOfDayInRome(new Date(date)) } },
    update: { isClosed, openTime: isClosed ? null : openTime, closeTime: isClosed ? null : closeTime, note },
    create: {
      appointmentTypeId,
      date: startOfDayInRome(new Date(date)),
      isClosed,
      openTime: isClosed ? null : openTime,
      closeTime: isClosed ? null : closeTime,
      note,
    },
  });

  return NextResponse.json({ exception });
}
