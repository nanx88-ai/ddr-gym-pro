"use client";

import { useEffect, useState } from "react";
import { formatDateTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { btnDanger, btnNeutral, btnPositive, pageSubtitle, pageTitle, tableHeadBg, tableWrap, td, th, trBorder } from "@/lib/ui";

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  isRecurring: boolean;
  source: string;
  client: { firstName: string; lastName: string; email: string; status: string };
  appointmentType: { name: string };
}

const FILTERS = [
  { value: "", label: "Tutte" },
  { value: "PENDING_APPROVAL", label: "In attesa" },
  { value: "APPROVED", label: "Confermate" },
  { value: "REJECTED", label: "Rifiutate" },
  { value: "CANCELLED", label: "Annullate" },
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/bookings${filter ? `?status=${filter}` : ""}`);
    const json = await res.json();
    setBookings(json.bookings ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div>
      <h1 className={pageTitle}>Prenotazioni</h1>
      <p className={pageSubtitle}>Approva, rifiuta o annulla le richieste ricevute.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value
                ? "rounded-full bg-yellow-400 px-3 py-1 text-xs font-medium text-neutral-900"
                : "rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-neutral-500">Caricamento...</p>}

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className={tableHeadBg}>
            <tr>
              <th className={th}>Cliente</th>
              <th className={th}>Servizio</th>
              <th className={th}>Orario</th>
              <th className={th}>Stato</th>
              <th className={th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className={trBorder}>
                <td className={td}>
                  <div className="font-medium text-neutral-900 dark:text-white">
                    {b.client.firstName} {b.client.lastName}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{b.client.email}</div>
                  {b.client.status === "PAUSED" && <span className="text-xs text-yellow-400">Cliente in pausa</span>}
                </td>
                <td className={td}>{b.appointmentType.name}</td>
                <td className={`${td} capitalize`}>{formatDateTime(b.startTime)}</td>
                <td className={td}>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                    {STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </td>
                <td className={td}>
                  <div className="flex gap-2">
                    {b.status === "PENDING_APPROVAL" && (
                      <>
                        <button onClick={() => updateStatus(b.id, "APPROVED")} className={btnPositive}>
                          Approva
                        </button>
                        <button onClick={() => updateStatus(b.id, "REJECTED")} className={btnDanger}>
                          Rifiuta
                        </button>
                      </>
                    )}
                    {["APPROVED", "RESCHEDULED"].includes(b.status) && (
                      <button onClick={() => updateStatus(b.id, "CANCELLED")} className={btnNeutral}>
                        Annulla
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nessuna prenotazione.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
