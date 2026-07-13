import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

const bodySchema = z.object({
  title: z.string().nullable().optional(),
  body: z.string().min(1),
  active: z.boolean().optional(),
});

/**
 * Crea un annuncio per la bacheca pubblica. Se nasce attivo, disattiva
 * prima tutti gli altri: al massimo un annuncio e' in bacheca alla volta.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.active) {
    await prisma.announcement.updateMany({ where: { active: true }, data: { active: false } });
  }
  const item = await prisma.announcement.create({ data: parsed.data });
  return NextResponse.json({ item });
}
