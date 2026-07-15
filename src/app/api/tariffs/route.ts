import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Tariffario pubblico: solo i servizi attivi con showInTariffs, per il pannello "Guarda le tariffe". */
export async function GET() {
  const items = await prisma.appointmentType.findMany({
    where: { active: true, showInTariffs: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, subtitle: true, quantity: true, unitPrice: true },
  });
  return NextResponse.json({
    items: items.map((i) => ({ id: i.id, title: i.name, subtitle: i.subtitle, quantity: i.quantity, price: i.unitPrice })),
  });
}
