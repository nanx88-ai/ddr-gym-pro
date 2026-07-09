import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Rimuove un override: lo slot torna al comportamento predefinito (aperto, capienza standard). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.slotOverride.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
