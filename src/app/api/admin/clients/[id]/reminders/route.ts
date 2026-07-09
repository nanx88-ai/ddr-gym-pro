import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reminders = await prisma.reminder.findMany({ where: { clientId: id }, orderBy: { dueDate: "asc" } });
  return NextResponse.json({ reminders });
}

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().min(1),
  notifyDaysBefore: z.number().int().min(0).max(90).default(7),
});

/** Scadenza libera creata dall'admin per un cliente (es. fine abbonamento, certificato medico). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const reminder = await prisma.reminder.create({
    data: {
      clientId: id,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: new Date(parsed.data.dueDate),
      notifyDaysBefore: parsed.data.notifyDaysBefore,
    },
  });

  return NextResponse.json({ reminder });
}
