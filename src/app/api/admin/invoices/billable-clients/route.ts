import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Elenco clienti con il loro stato di fatturazione, per la vista "Nuova
 * fattura": chi ha gia' un profilo attivo e non e' stato fatturato per il
 * periodo corrente compare come "da fatturare" (dueForInvoicing), cosi'
 * l'admin lo trova subito in cima senza dover ricordare a mente le scadenze.
 */
export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      billingProfile: { include: { appointmentType: { select: { name: true, unitPrice: true } } } },
      invoices: { orderBy: { periodEnd: "desc" }, take: 1, select: { periodEnd: true, issueDate: true } },
    },
  });

  const today = new Date();

  const result = clients.map((c) => {
    const lastInvoice = c.invoices[0] ?? null;
    const hasActiveProfile = !!c.billingProfile?.active;
    const dueForInvoicing = hasActiveProfile && (!lastInvoice || new Date(lastInvoice.periodEnd) < today);

    // Periodo suggerito: dalla fine dell'ultima fattura (o inizio mese
    // corrente se non ce n'e' mai stata una) a oggi.
    const suggestedStart = lastInvoice ? new Date(lastInvoice.periodEnd) : new Date(today.getFullYear(), today.getMonth(), 1);
    const suggestedEnd = today;

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      billingProfile: c.billingProfile
        ? {
            active: c.billingProfile.active,
            billingType: c.billingProfile.billingType,
            serviceName: c.billingProfile.appointmentType.name,
            unitPrice: c.billingProfile.appointmentType.unitPrice,
          }
        : null,
      lastInvoice: lastInvoice ? { periodEnd: lastInvoice.periodEnd, issueDate: lastInvoice.issueDate } : null,
      dueForInvoicing,
      suggestedPeriodStart: suggestedStart.toISOString().slice(0, 10),
      suggestedPeriodEnd: suggestedEnd.toISOString().slice(0, 10),
    };
  });

  return NextResponse.json({ clients: result });
}
