import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.tariff.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ items });
}

const bodySchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  price: z.number().min(0),
  sortOrder: z.number().int().optional(),
});

/** Voce del tariffario pubblico (vetrina prezzi, separata dal Listino di fatturazione). */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.tariff.create({ data: parsed.data });
  return NextResponse.json({ item });
}
