import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { config, ...rest } = parsed.data;
  const integration = await prisma.integration.update({
    where: { id },
    data: { ...rest, ...(config ? { config: JSON.stringify(config) } : {}) },
  });

  return NextResponse.json({ integration });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.integration.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
