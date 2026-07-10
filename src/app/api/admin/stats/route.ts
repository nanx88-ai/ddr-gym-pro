import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const WEEKDAY_LABELS = ["Domenica", "Lunedi'", "Martedi'", "Mercoledi'", "Giovedi'", "Venerdi'", "Sabato"];
const ACTIVE_STATUSES = ["PENDING_APPROVAL", "APPROVED", "RESCHEDULED", "RESCHEDULE_REQUESTED"];
const PAST_ATTENDANCE_STATUSES = ["APPROVED", "RESCHEDULED"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Statistiche admin. Tutto calcolato in JS su un unico pass sui dati (non
 * N+1), a partire da un dataset che nella pratica di una palestra resta
 * piccolo abbastanza da stare comodamente in memoria.
 *
 * Nota sulla "fascia oraria": qui e' una distribuzione delle prenotazioni
 * per ora del giorno (quali ore sono le piu' richieste), non un vero tasso
 * di riempimento capienza/prenotati - servirebbe generare tutti gli slot
 * teorici del periodo (con orari/eccezioni/override) per ogni servizio, un
 * calcolo pesante fuori scope per una prima versione di questa pagina.
 */
export async function GET() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [bookings, rescheduleRequests] = await Promise.all([
    prisma.booking.findMany({
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        attended: true,
        clientId: true,
        appointmentTypeId: true,
        createdAt: true,
        client: { select: { firstName: true, lastName: true, email: true, status: true } },
        appointmentType: { select: { name: true } },
      },
    }),
    prisma.rescheduleRequest.findMany({
      select: {
        booking: {
          select: {
            clientId: true,
            appointmentTypeId: true,
            client: { select: { firstName: true, lastName: true } },
            appointmentType: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const activeBookings = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));

  // --- Giorni piu' attivi (gia' esistente) ---
  const byWeekday = new Array(7).fill(0);
  for (const b of activeBookings) byWeekday[new Date(b.startTime).getDay()]++;
  const activeDays = byWeekday
    .map((count, dayOfWeek) => ({ dayOfWeek, label: WEEKDAY_LABELS[dayOfWeek], count }))
    .sort((a, b) => b.count - a.count);

  // --- Clienti con piu' prenotazioni (gia' esistente) ---
  const byClient = new Map<string, { firstName: string; lastName: string; email: string; count: number }>();
  for (const b of activeBookings) {
    const existing = byClient.get(b.clientId);
    if (existing) existing.count++;
    else byClient.set(b.clientId, { firstName: b.client.firstName, lastName: b.client.lastName, email: b.client.email, count: 1 });
  }
  const topClients = [...byClient.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  // --- 1. Prenotazioni per fascia oraria ---
  const byHour = new Array(24).fill(0);
  for (const b of activeBookings) byHour[new Date(b.startTime).getHours()]++;
  const bookingsByHour = byHour.map((count, hour) => ({ hour, count })).filter((h) => h.count > 0);

  // --- 2. Tasso di no-show (per servizio e per cliente) ---
  const pastMarked = bookings.filter((b) => PAST_ATTENDANCE_STATUSES.includes(b.status) && b.attended !== null);
  const noShowOverall = pastMarked.length
    ? Math.round((pastMarked.filter((b) => b.attended === false).length / pastMarked.length) * 100)
    : 0;

  const noShowByService = new Map<string, { name: string; total: number; noShow: number }>();
  const noShowByClient = new Map<string, { name: string; total: number; noShow: number }>();
  for (const b of pastMarked) {
    const svc = noShowByService.get(b.appointmentTypeId) ?? { name: b.appointmentType.name, total: 0, noShow: 0 };
    svc.total++;
    if (b.attended === false) svc.noShow++;
    noShowByService.set(b.appointmentTypeId, svc);

    const cli = noShowByClient.get(b.clientId) ?? {
      name: `${b.client.firstName} ${b.client.lastName}`,
      total: 0,
      noShow: 0,
    };
    cli.total++;
    if (b.attended === false) cli.noShow++;
    noShowByClient.set(b.clientId, cli);
  }
  const noShowRateByService = [...noShowByService.values()]
    .filter((s) => s.total >= 3)
    .map((s) => ({ name: s.name, rate: Math.round((s.noShow / s.total) * 100), total: s.total }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);
  const noShowRateByClient = [...noShowByClient.values()]
    .filter((c) => c.total >= 2 && c.noShow > 0)
    .map((c) => ({ name: c.name, rate: Math.round((c.noShow / c.total) * 100), total: c.total, noShow: c.noShow }))
    .sort((a, b) => b.noShow - a.noShow)
    .slice(0, 8);

  // --- 4. Clienti a rischio abbandono ---
  const lastBookingByClient = new Map<string, { name: string; email: string; lastDate: Date }>();
  for (const b of activeBookings) {
    const existing = lastBookingByClient.get(b.clientId);
    const d = new Date(b.startTime);
    if (!existing || d > existing.lastDate) {
      lastBookingByClient.set(b.clientId, { name: `${b.client.firstName} ${b.client.lastName}`, email: b.client.email, lastDate: d });
    }
  }
  const atRiskClients = [...lastBookingByClient.values()]
    .map((c) => ({ ...c, daysSince: Math.floor((now.getTime() - c.lastDate.getTime()) / 86400000) }))
    .filter((c) => c.daysSince >= 30 && c.daysSince <= 365)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 10)
    .map((c) => ({ name: c.name, email: c.email, daysSince: c.daysSince }));

  // --- 5. Servizio piu'/meno richiesto, trend vs mese precedente ---
  const thisMonthByService = new Map<string, { name: string; count: number }>();
  const lastMonthByService = new Map<string, number>();
  for (const b of activeBookings) {
    const created = new Date(b.startTime);
    if (created >= startOfThisMonth) {
      const e = thisMonthByService.get(b.appointmentTypeId) ?? { name: b.appointmentType.name, count: 0 };
      e.count++;
      thisMonthByService.set(b.appointmentTypeId, e);
    } else if (created >= startOfLastMonth && created < startOfThisMonth) {
      lastMonthByService.set(b.appointmentTypeId, (lastMonthByService.get(b.appointmentTypeId) ?? 0) + 1);
    }
  }
  const servicePopularity = [...thisMonthByService.entries()]
    .map(([id, cur]) => {
      const prev = lastMonthByService.get(id) ?? 0;
      const trendPct = prev === 0 ? null : Math.round(((cur.count - prev) / prev) * 100);
      return { name: cur.name, count: cur.count, previousCount: prev, trendPct };
    })
    .sort((a, b) => b.count - a.count);

  // --- 6. Tempo medio tra prenotazione e appuntamento (giorni di anticipo) ---
  const leadTimes = activeBookings
    .map((b) => (new Date(b.startTime).getTime() - new Date(b.createdAt).getTime()) / 86400000)
    .filter((d) => d >= 0);
  const avgLeadTimeDays = leadTimes.length ? Math.round((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10) / 10 : 0;

  // --- 8. Nuovi clienti vs ricorrenti (questo mese) ---
  const firstBookingByClient = new Map<string, Date>();
  for (const b of activeBookings) {
    const d = new Date(b.startTime);
    const existing = firstBookingByClient.get(b.clientId);
    if (!existing || d < existing) firstBookingByClient.set(b.clientId, d);
  }
  const clientsThisMonth = new Set(activeBookings.filter((b) => new Date(b.startTime) >= startOfThisMonth).map((b) => b.clientId));
  let newThisMonth = 0;
  let returningThisMonth = 0;
  for (const clientId of clientsThisMonth) {
    const first = firstBookingByClient.get(clientId);
    if (first && first >= startOfThisMonth) newThisMonth++;
    else returningThisMonth++;
  }

  // --- 10. Richieste di spostamento per cliente/servizio ---
  const rescheduleByClient = new Map<string, { name: string; count: number }>();
  const rescheduleByService = new Map<string, { name: string; count: number }>();
  for (const r of rescheduleRequests) {
    const cli = rescheduleByClient.get(r.booking.clientId) ?? {
      name: `${r.booking.client.firstName} ${r.booking.client.lastName}`,
      count: 0,
    };
    cli.count++;
    rescheduleByClient.set(r.booking.clientId, cli);

    const svc = rescheduleByService.get(r.booking.appointmentTypeId) ?? { name: r.booking.appointmentType.name, count: 0 };
    svc.count++;
    rescheduleByService.set(r.booking.appointmentTypeId, svc);
  }
  const rescheduleRequestsByClient = [...rescheduleByClient.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const rescheduleRequestsByService = [...rescheduleByService.values()].sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalBookings: activeBookings.length,
    activeDays,
    topClients,
    bookingsByHour,
    noShowOverall,
    noShowRateByService,
    noShowRateByClient,
    atRiskClients,
    servicePopularity,
    avgLeadTimeDays,
    newVsReturning: { new: newThisMonth, returning: returningThisMonth, monthLabel: monthKey(now) },
    rescheduleRequestsByClient,
    rescheduleRequestsByService,
  });
}
