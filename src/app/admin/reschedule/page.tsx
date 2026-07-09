"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { btnDanger, btnPositive, card, pageSubtitle, pageTitle } from "@/lib/ui";

interface RescheduleRequest {
  id: string;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string | null;
  createdAt: string;
  booking: {
    startTime: string;
    client: { firstName: string; lastName: string; email: string };
    appointmentType: { name: string };
  };
}

export default function AdminReschedulePage() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reschedule");
    const json = await res.json();
    setRequests(json.requests ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setError(null);
    const res = await fetch(`/api/admin/reschedule/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante l'operazione");
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className={pageTitle}>Richieste di spostamento</h1>
      <p className={pageSubtitle}>
        Coda dedicata alle richieste di riprogrammazione: a differenza del comportamento nativo osservato su
        Koalendar (dove lo spostamento autonomo sembra immediato), qui ogni richiesta resta pendente finche&apos; non
        approvata esplicitamente.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className={`${card} p-4`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-neutral-900 dark:text-white">
                  {r.booking.client.firstName} {r.booking.client.lastName} &middot; {r.booking.appointmentType.name}
                </div>
                <div className="mt-1 text-xs text-neutral-500 capitalize">Da: {formatDateTime(r.booking.startTime)}</div>
                <div className="text-xs text-neutral-500 capitalize">A: {formatDateTime(r.requestedStartTime)}</div>
                {r.reason && <div className="mt-1 text-xs italic text-neutral-500">&quot;{r.reason}&quot;</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide(r.id, "APPROVE")} className={btnPositive}>
                  Approva
                </button>
                <button onClick={() => decide(r.id, "REJECT")} className={btnDanger}>
                  Rifiuta
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && requests.length === 0 && (
          <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500`}>Nessuna richiesta in attesa.</p>
        )}
      </div>
    </div>
  );
}
