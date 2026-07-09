import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateInvoiceForClient, InvoicingError } from "@/lib/invoicing";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const invoices = await prisma.invoice.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: { issueDate: "desc" },
    include: { client: true },
  });
  return NextResponse.json({ invoices });
}

const bodySchema = z.object({
  clientId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

/** Genera una fattura per un cliente su un periodo (Prompt Master custom: fatturazione). */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const invoice = await generateInvoiceForClient(
      parsed.data.clientId,
      new Date(parsed.data.periodStart),
      new Date(parsed.data.periodEnd)
    );
    return NextResponse.json({ invoice });
  } catch (err) {
    if (err instanceof InvoicingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Errore durante la generazione della fattura" }, { status: 500 });
  }
}
