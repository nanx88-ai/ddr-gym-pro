import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  title: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

/** Modifica/attiva un annuncio. Attivarne uno disattiva tutti gli altri (max 1 in bacheca). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  if (parsed.data.active) {
    await prisma.announcement.updateMany({ where: { active: true, NOT: { id } }, data: { active: false } });
  }
  const item = await prisma.announcement.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
