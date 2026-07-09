import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  vatNature: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const item = await prisma.priceListItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ item });
}

/** Elimina una voce di listino. Blocca se e' usata in un profilo di fatturazione cliente. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.priceListItem.delete({ where: { id } });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "Questa voce e' usata nel profilo di fatturazione di un cliente: disattivala invece di eliminarla." },
        { status: 409 }
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
