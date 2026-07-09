import { prisma } from "@/lib/db";
import { format } from "date-fns";

export class InvoicingError extends Error {}

/** Numerazione progressiva per anno, es. "2026/0001". */
async function nextInvoiceNumber(year: number) {
  const prefix = `${year}/`;
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const lastSeq = last ? parseInt(last.number.split("/")[1], 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

/**
 * Genera una fattura per un cliente su un periodo, secondo la regola di
 * fatturazione configurata nel suo BillingProfile:
 * - PER_ACCESS: una riga per ogni prenotazione con presenza segnata (attended
 *   = true) nel periodo ("fattura mensile in base agli accessi effettivi",
 *   richiesto esplicitamente);
 * - FLAT: una riga unica a importo fisso, indipendente dagli accessi.
 */
export async function generateInvoiceForClient(clientId: string, periodStart: Date, periodEnd: Date) {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: { billingProfile: { include: { priceListItem: true } } },
  });

  if (!client.billingProfile || !client.billingProfile.active) {
    throw new InvoicingError("Il cliente non ha un profilo di fatturazione attivo.");
  }
  const { priceListItem, billingType } = client.billingProfile;

  type Line = {
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    vatNature: string | null;
    amount: number;
    bookingId: string | null;
  };

  let lines: Line[];

  if (billingType === "PER_ACCESS") {
    const attendedBookings = await prisma.booking.findMany({
      where: { clientId, attended: true, startTime: { gte: periodStart, lt: periodEnd } },
      include: { appointmentType: true },
      orderBy: { startTime: "asc" },
    });
    if (attendedBookings.length === 0) {
      throw new InvoicingError("Nessun accesso effettivo registrato in questo periodo.");
    }
    lines = attendedBookings.map((b) => ({
      description: `Accesso del ${format(b.startTime, "dd/MM/yyyy")} - ${b.appointmentType.name}`,
      quantity: 1,
      unitPrice: priceListItem.unitPrice,
      vatRate: priceListItem.vatRate,
      vatNature: priceListItem.vatNature,
      amount: priceListItem.unitPrice,
      bookingId: b.id,
    }));
  } else {
    lines = [
      {
        description: `${priceListItem.name} - ${format(periodStart, "MM/yyyy")}`,
        quantity: 1,
        unitPrice: priceListItem.unitPrice,
        vatRate: priceListItem.vatRate,
        vatNature: priceListItem.vatNature,
        amount: priceListItem.unitPrice,
        bookingId: null,
      },
    ];
  }

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const vatAmount = lines.reduce((sum, l) => sum + (l.amount * l.vatRate) / 100, 0);
  const total = subtotal + vatAmount;
  const number = await nextInvoiceNumber(new Date().getFullYear());

  return prisma.invoice.create({
    data: {
      number,
      clientId,
      periodStart,
      periodEnd,
      status: "DRAFT",
      subtotal,
      vatAmount,
      total,
      lineItems: { create: lines },
    },
    include: { lineItems: true, client: true },
  });
}
