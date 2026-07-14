"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { card, input, pageSubtitle, pageTitle, toggleActive, toggleInactive } from "@/lib/ui";

interface ActiveDay {
  dayOfWeek: number;
  label: string;
  count: number;
}

interface TopClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  count: number;
}

interface HourBucket {
  hour: number;
  count: number;
}

interface NoShowService {
  name: string;
  rate: number;
  total: number;
}

interface NoShowClient {
  name: string;
  rate: number;
  total: number;
  noShow: number;
}

interface AtRiskClient {
  name: string;
  email: string;
  daysSince: number;
}

interface ServicePopularity {
  name: string;
  count: number;
  previousCount: number;
  trendPct: number | null;
}

interface RescheduleByClient {
  name: string;
  count: number;
}

interface RescheduleByService {
  name: string;
  count: number;
}

interface Stats {
  totalBookings: number;
  activeDays: ActiveDay[];
  topClients: TopClient[];
  bookingsByHour: HourBucket[];
  noShowOverall: number;
  noShowRateByService: NoShowService[];
  noShowRateByClient: NoShowClient[];
  atRiskClients: AtRiskClient[];
  servicePopularity: ServicePopularity[];
  avgLeadTimeDays: number;
  newVsReturning: { new: number; returning: number; monthLabel: string };
  rescheduleRequestsByClient: RescheduleByClient[];
  rescheduleRequestsByService: RescheduleByService[];
}

function BarRow({ label, count, max, suffix = "" }: { label: string; count: number; max: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-neutral-600 dark:text-neutral-300">{label}</span>
      <div className="h-2 flex-1 bg-neutral-100 dark:bg-neutral-800">
        <div className="h-2 bg-yellow-400" style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-white">
        {count}
        {suffix}
      </span>
    </div>
  );
}

function StatCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={`${card} p-4`}>
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h2>
      {note && <p className="mb-3 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

const REFRESH_MS = 60000;

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState("all");

  function applyPreset(preset: string) {
    setActivePreset(preset);
    const today = new Date();
    switch (preset) {
      case "lastMonth":
        setDateFrom(toIso(addMonths(today, -1)));
        setDateTo(toIso(today));
        break;
      case "nextMonth":
        setDateFrom(toIso(today));
        setDateTo(toIso(addMonths(today, 1)));
        break;
      case "last3":
        setDateFrom(toIso(addMonths(today, -3)));
        setDateTo(toIso(today));
        break;
      case "next3":
        setDateFrom(toIso(today));
        setDateTo(toIso(addMonths(today, 3)));
        break;
      case "thisYear":
        setDateFrom(toIso(new Date(today.getFullYear(), 0, 1)));
        setDateTo(toIso(today));
        break;
      default:
        setDateFrom("");
        setDateTo("");
    }
  }

  useEffect(() => {
    function load() {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const qs = params.toString();
      fetch(`/api/admin/stats${qs ? `?${qs}` : ""}`)
        .then((res) => res.json())
        .then(setStats);
    }
    load();
    // Dati sempre aggiornati anche a pagina aperta a lungo (es. su un
    // monitor in bacheca), senza dover ricaricare a mano.
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [dateFrom, dateTo]);

  if (!stats) return <p className="text-sm text-neutral-500">Caricamento...</p>;

  const PILLS = [
    { key: "all", label: "Perpetuo" },
    { key: "lastMonth", label: "Ultimo mese" },
    { key: "nextMonth", label: "Prossimo mese" },
    { key: "next3", label: "Prossimi 3 mesi" },
    { key: "last3", label: "Ultimi 3 mesi" },
    { key: "thisYear", label: "Questo anno" },
  ];

  const maxDayCount = Math.max(1, ...stats.activeDays.map((d) => d.count));
  const maxClientCount = Math.max(1, ...stats.topClients.map((c) => c.count));
  const maxHourCount = Math.max(1, ...stats.bookingsByHour.map((h) => h.count));
  const maxServiceCount = Math.max(1, ...stats.servicePopularity.map((s) => s.count));
  const maxRescheduleClient = Math.max(1, ...stats.rescheduleRequestsByClient.map((r) => r.count));
  const maxRescheduleService = Math.max(1, ...stats.rescheduleRequestsByService.map((r) => r.count));
  const newVsReturningTotal = stats.newVsReturning.new + stats.newVsReturning.returning;

  return (
    <div>
      <h1 className={pageTitle}>Statistiche</h1>
      <p className={pageSubtitle}>
        Basate su {stats.totalBookings} prenotazion{stats.totalBookings === 1 ? "e" : "i"} confermate, in attesa o riprogrammate.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Da</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setActivePreset("custom");
            }}
            className={`${input} w-40 min-w-0`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">A</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setActivePreset("custom");
            }}
            className={`${input} w-40 min-w-0`}
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {PILLS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`min-h-11 border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                activePreset === p.key ? toggleActive : toggleInactive
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <StatCard title="Giorni piu' attivi">
          <div className="space-y-2">
            {stats.activeDays.map((d) => (
              <BarRow key={d.dayOfWeek} label={d.label} count={d.count} max={maxDayCount} />
            ))}
            {stats.activeDays.every((d) => d.count === 0) && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun dato ancora.</p>
            )}
          </div>
        </StatCard>

        <StatCard title="Clienti con piu' prenotazioni">
          <div className="space-y-2">
            {stats.topClients.map((c, i) => (
              <div key={c.email} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/clients/${c.id}`}
                    className="block truncate text-sm text-neutral-800 hover:text-yellow-600 dark:text-neutral-200 dark:hover:text-yellow-400"
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                  <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800">
                    <div className="h-1.5 bg-yellow-400" style={{ width: `${(c.count / maxClientCount) * 100}%` }} />
                  </div>
                </div>
                <span className="w-6 shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-white">{c.count}</span>
              </div>
            ))}
            {stats.topClients.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun dato ancora.</p>}
          </div>
        </StatCard>

        <StatCard title="Prenotazioni per fascia oraria" note="Quali ore sono le piu' richieste (conteggio, non capienza).">
          <div className="space-y-2">
            {stats.bookingsByHour.map((h) => (
              <BarRow key={h.hour} label={`${String(h.hour).padStart(2, "0")}:00`} count={h.count} max={maxHourCount} />
            ))}
            {stats.bookingsByHour.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun dato ancora.</p>}
          </div>
        </StatCard>

        <StatCard title="Tasso di no-show" note="Sulle prenotazioni passate con presenza segnata.">
          <p className="mb-3 text-2xl font-bold text-neutral-900 dark:text-white">
            {stats.noShowOverall}
            <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400"> complessivo</span>
          </p>
          {stats.noShowRateByClient.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Clienti con piu' assenze</p>
              <div className="space-y-1.5">
                {stats.noShowRateByClient.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-neutral-700 dark:text-neutral-200">{c.name}</span>
                    <span className="shrink-0 text-neutral-500 dark:text-neutral-400">
                      {c.noShow}/{c.total} ({c.rate}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {stats.noShowRateByClient.length === 0 && stats.noShowRateByService.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun dato ancora.</p>
          )}
        </StatCard>

        <StatCard title="Clienti a rischio abbandono" note="Nessuna prenotazione da almeno 30 giorni.">
          <div className="space-y-1.5">
            {stats.atRiskClients.map((c) => (
              <div key={c.email} className="flex items-center justify-between text-sm">
                <span className="truncate text-neutral-700 dark:text-neutral-200">{c.name}</span>
                <span className="shrink-0 text-amber-600 dark:text-amber-400">{c.daysSince}gg fa</span>
              </div>
            ))}
            {stats.atRiskClients.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun cliente a rischio.</p>}
          </div>
        </StatCard>

        <StatCard title="Servizi: popolarita' e trend" note="Questo mese vs mese precedente.">
          <div className="space-y-2">
            {stats.servicePopularity.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-sm text-neutral-600 dark:text-neutral-300">{s.name}</span>
                <div className="h-2 flex-1 bg-neutral-100 dark:bg-neutral-800">
                  <div className="h-2 bg-yellow-400" style={{ width: `${(s.count / maxServiceCount) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-white">{s.count}</span>
                <span
                  className={`w-12 shrink-0 text-right text-xs font-medium ${
                    s.trendPct == null
                      ? "text-neutral-400 dark:text-neutral-500"
                      : s.trendPct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {s.trendPct == null ? "-" : `${s.trendPct >= 0 ? "+" : ""}${s.trendPct}%`}
                </span>
              </div>
            ))}
            {stats.servicePopularity.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun dato questo mese.</p>}
          </div>
        </StatCard>

        <StatCard title="Anticipo medio di prenotazione">
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">
            {stats.avgLeadTimeDays}
            <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400"> giorni prima dell'appuntamento</span>
          </p>
        </StatCard>

        <StatCard title="Nuovi vs clienti ricorrenti" note="Prenotazioni di questo mese.">
          {newVsReturningTotal > 0 ? (
            <div>
              <div className="flex h-2.5 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <div className="h-full bg-yellow-400" style={{ width: `${(stats.newVsReturning.new / newVsReturningTotal) * 100}%` }} />
                <div className="h-full bg-neutral-400 dark:bg-neutral-600" style={{ width: `${(stats.newVsReturning.returning / newVsReturningTotal) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-neutral-700 dark:text-neutral-200">
                  <span className="mr-1.5 inline-block h-2 w-2 bg-yellow-400" />
                  Nuovi: {stats.newVsReturning.new}
                </span>
                <span className="text-neutral-700 dark:text-neutral-200">
                  <span className="mr-1.5 inline-block h-2 w-2 bg-neutral-400 dark:bg-neutral-600" />
                  Ricorrenti: {stats.newVsReturning.returning}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna prenotazione questo mese.</p>
          )}
        </StatCard>

        <StatCard title="Richieste di spostamento per servizio">
          <div className="space-y-2">
            {stats.rescheduleRequestsByService.map((r) => (
              <BarRow key={r.name} label={r.name} count={r.count} max={maxRescheduleService} />
            ))}
            {stats.rescheduleRequestsByService.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna richiesta di spostamento.</p>
            )}
          </div>
        </StatCard>

        <StatCard title="Richieste di spostamento per cliente">
          <div className="space-y-2">
            {stats.rescheduleRequestsByClient.map((r) => (
              <BarRow key={r.name} label={r.name} count={r.count} max={maxRescheduleClient} />
            ))}
            {stats.rescheduleRequestsByClient.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna richiesta di spostamento.</p>
            )}
          </div>
        </StatCard>
      </div>
    </div>
  );
}
