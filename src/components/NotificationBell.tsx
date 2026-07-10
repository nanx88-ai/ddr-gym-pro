"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

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
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchItems(): Promise<PendingItem[]> {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return [];
      const json = await res.json().catch(() => null);
      return json?.items ?? [];
    } catch {
      // rete assente/tab in background/server riavviato: riprovera' al prossimo poll
      return [];
    }
  }

  async function load() {
    setItems(await fetchItems());
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const items = await fetchItems();
      if (!cancelled) setItems(items);
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
    if (status === "REJECTED" && !(await confirm("Rifiutare questa richiesta di prenotazione?"))) return;
    setBusyId(id);
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast.success(status === "APPROVED" ? "Prenotazione approvata." : "Prenotazione rifiutata.");
    await load();
    setBusyId(null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifiche"
        className="relative flex h-9 w-9 items-center justify-center text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-red-500 px-1 text-[10px] font-semibold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay mobile: piu' marcato di quello del menu, per isolare il pannello notifiche */}
          <div className="fixed inset-0 z-40 bg-black/70 sm:hidden" onClick={() => setOpen(false)} />

          <div className="fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-hidden border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-w-[92vw]">
            <div className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900 dark:border-neutral-800 dark:text-white">
              Richieste in attesa
            </div>
            <div className="max-h-[calc(75vh-84px)] overflow-y-auto sm:max-h-96">
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Nessuna richiesta in attesa.
                </p>
              )}
              {items.map((b) => (
                <div key={b.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-neutral-900 dark:text-white">
                      {b.client.firstName} {b.client.lastName}
                    </div>
                    <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{b.appointmentType.name}</div>
                    <div className="mt-0.5 text-sm font-bold capitalize text-yellow-600 dark:text-yellow-400">
                      {formatDateTime(b.startTime)}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span
                        className={`font-bold ${b.spotsLeft <= 1 ? "text-amber-600 dark:text-amber-400" : "text-yellow-600 dark:text-yellow-400"}`}
                      >
                        {b.spotsLeft}
                      </span>{" "}
                      post{b.spotsLeft === 1 ? "o" : "i"} rimast{b.spotsLeft === 1 ? "o" : "i"} su {b.capacity}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => decide(b.id, "APPROVED")}
                      disabled={busyId === b.id}
                      aria-label="Approva"
                      title="Approva"
                      className="flex h-11 w-11 items-center justify-center bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => decide(b.id, "REJECTED")}
                      disabled={busyId === b.id}
                      aria-label="Rifiuta"
                      title="Rifiuta"
                      className="flex h-11 w-11 items-center justify-center bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                      </svg>
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
        </>
      )}
    </div>
  );
}
