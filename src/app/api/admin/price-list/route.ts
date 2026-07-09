import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.priceListItem.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unitPrice: z.number().min(0),
  vatRate: z.number().min(0).max(100),
  vatNature: z.string().nullable().optional(),
});

/** Voce di listino: prezzo unitario, IVA o natura di esenzione (codici FatturaPA N1..N7). */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.priceListItem.create({ data: parsed.data });
  return NextResponse.json({ item });
}
