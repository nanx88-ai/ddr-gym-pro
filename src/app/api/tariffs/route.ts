import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Tariffario pubblico: solo le voci attive, per il pannello "Guarda le tariffe". */
export async function GET() {
  const items = await prisma.tariff.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, subtitle: true, quantity: true, price: true },
  });
  return NextResponse.json({ items });
}
