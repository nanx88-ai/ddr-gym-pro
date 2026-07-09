import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  requiresApproval: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Modifica un calendario/servizio (nome, durata slot, capienza predefinita, approvazione, attivo/disattivo). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const appointmentType = await prisma.appointmentType.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ appointmentType });
}
