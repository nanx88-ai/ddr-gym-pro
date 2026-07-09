import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "desc" },
    include: { client: true },
  });

  const rows = invoices.map((inv) => ({
    number: inv.number,
    issueDate: inv.issueDate.toISOString(),
    clientName: `${inv.client.firstName} ${inv.client.lastName}`,
    clientEmail: inv.client.email,
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    subtotal: inv.subtotal,
    vatAmount: inv.vatAmount,
    total: inv.total,
    status: inv.status,
  }));

  const csv = toCsv(rows, [
    { key: "number", label: "Numero" },
    { key: "issueDate", label: "Data emissione" },
    { key: "clientName", label: "Cliente" },
    { key: "clientEmail", label: "Email" },
    { key: "periodStart", label: "Periodo da" },
    { key: "periodEnd", label: "Periodo a" },
    { key: "subtotal", label: "Imponibile" },
    { key: "vatAmount", label: "IVA" },
    { key: "total", label: "Totale" },
    { key: "status", label: "Stato" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fatture.csv"`,
    },
  });
}
