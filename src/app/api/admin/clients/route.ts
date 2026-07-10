import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const clients = await prisma.client.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bookings: true } },
      // Solo i campi necessari ai filtri (servizio prenotato, ultima
      // prenotazione): non l'intero record booking, per non appesantire
      // la risposta con anagrafiche grandi.
      bookings: { select: { startTime: true, appointmentTypeId: true, appointmentType: { select: { name: true } } } },
      reminders: { where: { dueDate: { gte: new Date() } }, orderBy: { dueDate: "asc" }, take: 1, select: { dueDate: true, title: true } },
    },
  });
  return NextResponse.json({ clients });
}
