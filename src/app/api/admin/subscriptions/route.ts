import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.subscription.findMany({
    orderBy: { endDate: "asc" },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      tariff: { select: { id: true, title: true, price: true } },
    },
  });
  return NextResponse.json({ items });
}

const bodySchema = z.object({
  clientId: z.string().min(1),
  tariffId: z.string().min(1),
  startDate: z.string().min(1), // ISO date
  endDate: z.string().min(1),
  autoRenew: z.boolean().optional(),
  renewMonths: z.number().int().min(1).max(36).optional(),
  notifyDaysBefore: z.number().int().min(0).max(90).optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }
  const { startDate, endDate, ...rest } = parsed.data;
  if (new Date(endDate) <= new Date(startDate)) {
    return NextResponse.json({ error: "La scadenza deve essere successiva alla data di inizio." }, { status: 400 });
  }

  const item = await prisma.subscription.create({
    data: { ...rest, startDate: new Date(startDate), endDate: new Date(endDate) },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      tariff: { select: { id: true, title: true, price: true } },
    },
  });
  return NextResponse.json({ item });
}
