import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Prenotazioni per la sezione Agenda: intervallo di date + filtri opzionali
 * (stato, servizio, ricerca cliente). A differenza di /api/admin/bookings
 * (senza limiti di data, usata dalla pagina Prenotazioni) qui serve un
 * range perche' le viste giorno/settimana/mese caricano solo cio' che
 * mostrano.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const status = searchParams.get("status");
  const appointmentTypeId = searchParams.get("appointmentTypeId");
  const q = searchParams.get("q")?.trim();

  if (!start || !end) {
    return NextResponse.json({ error: "Parametri start/end mancanti" }, { status: 400 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      startTime: { gte: new Date(start), lte: new Date(end) },
      ...(status ? { status } : {}),
      ...(appointmentTypeId ? { appointmentTypeId } : {}),
      ...(q
        ? {
            OR: [
              { client: { firstName: { contains: q, mode: "insensitive" } } },
              { client: { lastName: { contains: q, mode: "insensitive" } } },
              { client: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { startTime: "asc" },
    include: { client: true, appointmentType: true },
  });

  return NextResponse.json({ bookings });
}
