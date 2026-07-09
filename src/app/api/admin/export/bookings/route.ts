import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    orderBy: { startTime: "desc" },
    include: { client: true, appointmentType: true },
  });

  const rows = bookings.map((b) => ({
    startTime: b.startTime.toISOString(),
    clientName: `${b.client.firstName} ${b.client.lastName}`,
    clientEmail: b.client.email,
    appointmentType: b.appointmentType.name,
    status: b.status,
    attended: b.attended === null ? "" : b.attended ? "SI" : "NO",
    source: b.source,
  }));

  const csv = toCsv(rows, [
    { key: "startTime", label: "Data e ora" },
    { key: "clientName", label: "Cliente" },
    { key: "clientEmail", label: "Email" },
    { key: "appointmentType", label: "Servizio" },
    { key: "status", label: "Stato" },
    { key: "attended", label: "Presente" },
    { key: "source", label: "Origine" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prenotazioni.csv"`,
    },
  });
}
