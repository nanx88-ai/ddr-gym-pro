import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  appointmentTypeId: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  autoRenew: z.boolean().optional(),
  renewMonths: z.number().int().min(1).max(36).optional(),
  notifyDaysBefore: z.number().int().min(0).max(90).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { startDate, endDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (startDate) data.startDate = new Date(startDate);
  // Cambiare la scadenza azzera il "gia' notificato": la nuova scadenza
  // merita il suo promemoria.
  if (endDate) {
    data.endDate = new Date(endDate);
    data.notifiedForEnd = null;
  }

  const item = await prisma.subscription.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      appointmentType: { select: { id: true, name: true, unitPrice: true } },
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.subscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
