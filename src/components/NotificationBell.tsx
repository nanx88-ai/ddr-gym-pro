"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { btnDanger, btnPositive } from "@/lib/ui";

interface PendingItem {
  id: string;
  startTime: string;
  client: { firstName: string; lastName: string };
  appointmentType: { name: string };
  capacity: number;
  spotsLeft: number;
}

const POLL_MS = 20000;

/**
 * Notifiche admin: per ora solo le richieste di appuntamento in attesa di
 * approvazione, con azioni dirette (Approva/Rifiuta) e i posti ancora
 * disponibili per lo slot, cosi' l'admin puo' decidere senza uscire dal
 * pannello. Altri tipi di notifica si aggiungeranno qui in futuro.
 */
export default function NotificationBell() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/admin/notifications");
    const json = await res.json();
    setItems(json.items ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const res = await fetch("/api/admin/notifications");
      const json = await res.json();
      if (!cancelled) setItems(json.items ?? []);
    }
    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setBusyId(null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifiche"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[92vw] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900 dark:border-neutral-800 dark:text-white">
            Richieste in attesa
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                Nessuna richiesta in attesa.
              </p>
            )}
            {items.map((b) => (
              <div key={b.id} className="border-b border-neutral-100 px-4 py-3 text-sm last:border-0 dark:border-neutral-800">
                <div className="font-medium text-neutral-900 dark:text-white">
                  {b.client.firstName} {b.client.lastName}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {b.appointmentType.name} · {formatDateTime(b.startTime)}
                </div>
                <div
                  className={`mt-1 text-xs font-medium ${
                    b.spotsLeft <= 1 ? "text-amber-600 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {b.spotsLeft} post{b.spotsLeft === 1 ? "o" : "i"} rimasti su {b.capacity} per questo slot
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => decide(b.id, "APPROVED")}
                    disabled={busyId === b.id}
                    className={`${btnPositive} flex-1 disabled:opacity-50`}
                  >
                    Approva
                  </button>
                  <button
                    onClick={() => decide(b.id, "REJECTED")}
                    disabled={busyId === b.id}
                    className={`${btnDanger} flex-1 disabled:opacity-50`}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <Link
              href="/admin?status=PENDING_APPROVAL"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-xs font-medium text-yellow-600 hover:underline dark:text-yellow-400"
            >
              Vedi tutte nella pagina Prenotazioni
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
