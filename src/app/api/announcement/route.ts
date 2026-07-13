import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Annuncio attivo (al piu' uno) per il banner sulla pagina pubblica di prenotazione. */
export async function GET() {
  const item = await prisma.announcement.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, body: true },
  });
  return NextResponse.json({ item });
}
