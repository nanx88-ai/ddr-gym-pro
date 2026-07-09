import { NextRequest, NextResponse } from "next/server";
import { subDays, addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { buildIcsCalendar } from "@/lib/ics";

/**
 * Feed ICS pubblico (protetto da token, non da sessione admin: le app
 * calendario di Google/Apple non hanno il cookie di sessione). Fuori da
 * /api/admin apposta, cosi' il middleware non lo blocca.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token mancante" }, { status: 401 });
  }

  const integrations = await prisma.integration.findMany({ where: { type: "calendar_feed" } });
  const valid = integrations.some((i) => {
    try {
      return (JSON.parse(i.config) as { token: string }).token === token;
    } catch {
      return false;
    }
  });
  if (!valid) {
    return NextResponse.json({ error: "Token non valido" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["APPROVED", "RESCHEDULED"] },
      startTime: { gte: subDays(new Date(), 30), lte: addDays(new Date(), 365) },
    },
    include: { client: true, appointmentType: true },
    orderBy: { startTime: "asc" },
  });

  const ics = buildIcsCalendar(bookings);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=palestra.ics",
    },
  });
}
