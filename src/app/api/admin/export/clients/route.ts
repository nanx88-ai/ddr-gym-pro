import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { lastName: "asc" } });

  const csv = toCsv(clients, [
    { key: "firstName", label: "Nome" },
    { key: "lastName", label: "Cognome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefono" },
    { key: "status", label: "Stato" },
    { key: "clientKind", label: "Tipo cliente" },
    { key: "businessName", label: "Ragione sociale" },
    { key: "fiscalCode", label: "Codice fiscale" },
    { key: "vatNumber", label: "Partita IVA" },
    { key: "address", label: "Indirizzo" },
    { key: "zipCode", label: "CAP" },
    { key: "city", label: "Citta'" },
    { key: "province", label: "Provincia" },
    { key: "country", label: "Paese" },
    { key: "pec", label: "PEC" },
    { key: "sdiCode", label: "Codice SDI" },
    { key: "createdAt", label: "Registrato il" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clienti.csv"`,
    },
  });
}
