"use client";

import { useEffect, useState } from "react";
import { card, pageSubtitle, pageTitle } from "@/lib/ui";

interface ActiveDay {
  dayOfWeek: number;
  label: string;
  count: number;
}

interface TopClient {
  firstName: string;
  lastName: string;
  email: string;
  count: number;
}

interface Stats {
  totalBookings: number;
  activeDays: ActiveDay[];
  topClients: TopClient[];
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  if (!stats) return <p className="text-sm text-neutral-500">Caricamento...</p>;

  const maxDayCount = Math.max(1, ...stats.activeDays.map((d) => d.count));
  const maxClientCount = Math.max(1, ...stats.topClients.map((c) => c.count));

  return (
    <div className="max-w-4xl">
      <h1 className={pageTitle}>Statistiche</h1>
      <p className={pageSubtitle}>
        Basate su {stats.totalBookings} prenotazion
        {stats.totalBookings === 1 ? "e" : "i"} confermate o in attesa.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className={`${card} p-4`}>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Giorni piu'attivi
          </h2>
          <div className="space-y-2">
            {stats.activeDays.map((d) => (
              <div key={d.dayOfWeek} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-neutral-600 dark:text-neutral-300">
                  {d.label}
                </span>
                <div className="h-2 flex-1 bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className="h-2 bg-yellow-400"
                    style={{ width: `${(d.count / maxDayCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-white">
                  {d.count}
                </span>
              </div>
            ))}
            {stats.activeDays.every((d) => d.count === 0) && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Nessun dato ancora.
              </p>
            )}
          </div>
        </section>

        <section className={`${card} p-4`}>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Clienti con piu'prenotazioni
          </h2>
          <div className="space-y-2">
            {stats.topClients.map((c, i) => (
              <div key={c.email} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-neutral-800 dark:text-neutral-200">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-1.5 bg-yellow-400"
                      style={{ width: `${(c.count / maxClientCount) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-6 shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-white">
                  {c.count}
                </span>
              </div>
            ))}
            {stats.topClients.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Nessun dato ancora.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
