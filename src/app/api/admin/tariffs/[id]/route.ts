import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const item = await prisma.tariff.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ item });
}

/** Elimina una tariffa. Blocca se un abbonamento la usa: va messa in pausa invece. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.tariff.delete({ where: { id } });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "Questa tariffa e' usata in un abbonamento: mettila in pausa invece di eliminarla." },
        { status: 409 }
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
