import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getInvoiceProvider } from "@/lib/invoicing-providers";

const bodySchema = z.object({ provider: z.string().min(1) });

/**
 * Invia la fattura tramite il provider scelto e salva sempre l'esito
 * (successo o errore) in InvoiceSubmission, cosi' restano tracciati gli
 * stati restituiti dal sistema anche quando l'invio fallisce (richiesto
 * esplicitamente: "salvataggio esiti e stati restituiti dal sistema").
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const provider = getInvoiceProvider(parsed.data.provider);
  if (!provider) {
    return NextResponse.json({ error: "Provider sconosciuto" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: true, client: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Fattura non trovata" }, { status: 404 });
  }

  const result = await provider.send(invoice);

  await prisma.invoiceSubmission.create({
    data: {
      invoiceId: id,
      provider: provider.id,
      status: result.status,
      requestPayload: result.requestPayload ? JSON.stringify(result.requestPayload) : null,
      responsePayload: result.responsePayload ? JSON.stringify(result.responsePayload) : null,
      externalId: result.externalId,
      errorMessage: result.errorMessage,
    },
  });

  if (result.status === "SUCCESS") {
    await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });
  } else {
    await prisma.invoice.update({ where: { id }, data: { status: "ERROR" } });
  }

  return NextResponse.json({ result });
}
