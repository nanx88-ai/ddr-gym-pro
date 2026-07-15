import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  clientId: z.string().min(1),
  appointmentTypeId: z.string().min(1),
  billingType: z.enum(["PER_ACCESS", "FLAT"]),
  active: z.boolean().default(true),
});

/** Crea/aggiorna il profilo di fatturazione di un cliente (regola di conteggio + servizio). */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId, ...data } = parsed.data;

  const profile = await prisma.billingProfile.upsert({
    where: { clientId },
    update: data,
    create: { clientId, ...data },
  });

  return NextResponse.json({ profile });
}
