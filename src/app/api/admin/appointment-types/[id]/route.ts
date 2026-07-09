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

/** Elimina un calendario/servizio. Blocca se ha prenotazioni storiche collegate. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Config pulibile senza perdita di storico: eccezioni, override slot, orario settimanale.
  await prisma.weeklySchedule.deleteMany({ where: { appointmentTypeId: id } });
  await prisma.scheduleException.deleteMany({ where: { appointmentTypeId: id } });
  await prisma.slotOverride.deleteMany({ where: { appointmentTypeId: id } });

  try {
    await prisma.appointmentType.delete({ where: { id } });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "Questo calendario ha prenotazioni collegate: disattivalo invece di eliminarlo." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
