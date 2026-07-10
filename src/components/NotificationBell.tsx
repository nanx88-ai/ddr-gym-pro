"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface PendingApproval {
  type: "pending_approval";
  id: string;
  bookingId: string;
  startTime: string;
  client: { firstName: string; lastName: string };
  appointmentType: { name: string };
  capacity: number;
  spotsLeft: number;
}

interface RescheduleRequestItem {
  type: "reschedule_request";
  id: string;
  requestId: string;
  startTime: string;
  reason: string | null;
  client: { firstName: string; lastName: string };
  appointmentType: { name: string };
}

type ActionableItem = PendingApproval | RescheduleRequestItem;

interface InformationalItem {
  type: "new_booking" | "cancellation" | "reminder_due";
  id: string;
  startTime: string;
  at: string;
  client: { firstName: string; lastName: string };
  appointmentType?: { name: string };
  title?: string;
}

const POLL_MS = 20000;
const DISMISSED_KEY = "koalendar_dismissed_notifications";

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  // tetto di sicurezza, non deve crescere all'infinito
  const arr = [...ids].slice(-300);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
}

const TYPE_LABEL: Record<InformationalItem["type"], string> = {
  new_booking: "Nuova prenotazione",
  cancellation: "Prenotazione annullata",
  reminder_due: "Scadenza in arrivo",
};

/**
 * Notifiche admin: tutto cio' che richiede attenzione, non solo le richieste
 * da approvare - anche prenotazioni auto-confermate, cancellazioni,
 * richieste di spostamento e scadenze in arrivo. Le prime due categorie
 * (approvazioni/spostamenti) sono azionabili e spariscono da sole quando
 * risolte; le altre sono informative e restano visibili per una finestra di
 * tempo lato server, scartabili singolarmente (persistito in localStorage,
 * per-dispositivo).
 */
export default function NotificationBell() {
  const toast = useToast();
  const confirm = useConfirm();
  const [actionable, setActionable] = useState<ActionableItem[]>([]);
  const [informational, setInformational] = useState<InformationalItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  async function fetchItems() {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  }

  async function load() {
    const json = await fetchItems();
    if (json) {
      setActionable(json.actionable ?? []);
      setInformational(json.informational ?? []);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const json = await fetchItems();
      if (!cancelled && json) {
        setActionable(json.actionable ?? []);
        setInformational(json.informational ?? []);
      }
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

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  async function decideApproval(item: PendingApproval, status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !(await confirm("Rifiutare questa richiesta di prenotazione?"))) return;
    setBusyId(item.id);
    await fetch(`/api/admin/bookings/${item.bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast.success(status === "APPROVED" ? "Prenotazione approvata." : "Prenotazione rifiutata.");
    await load();
    setBusyId(null);
  }

  async function decideReschedule(item: RescheduleRequestItem, decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !(await confirm("Rifiutare questa richiesta di spostamento?"))) return;
    setBusyId(item.id);
    const res = await fetch(`/api/admin/reschedule/${item.requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Errore durante l'operazione.");
    } else {
      toast.success(decision === "APPROVE" ? "Spostamento approvato." : "Spostamento rifiutato.");
    }
    await load();
    setBusyId(null);
  }

  const visibleInformational = informational.filter((i) => !dismissed.has(i.id));
  const totalCount = actionable.length + visibleInformational.length;

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
        {totalCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-red-500 px-1 text-[10px] font-semibold text-white">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay mobile: piu' marcato di quello del menu, per isolare il pannello notifiche */}
          <div className="fixed inset-0 z-40 bg-black/70 sm:hidden" onClick={() => setOpen(false)} />

          <div className="fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-hidden border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-w-[92vw]">
            <div className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900 dark:border-neutral-800 dark:text-white">
              Notifiche
            </div>
            <div className="max-h-[calc(75vh-84px)] overflow-y-auto sm:max-h-96">
              {totalCount === 0 && (
                <p className="px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Nessuna notifica.</p>
              )}

              {actionable.map((item) =>
                item.type === "pending_approval" ? (
                  <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-neutral-900 dark:text-white">
                        {item.client.firstName} {item.client.lastName}
                      </div>
                      <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{item.appointmentType.name}</div>
                      <div className="mt-0.5 text-sm font-bold capitalize text-yellow-600 dark:text-yellow-400">
                        {formatDateTime(item.startTime)}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <span
                          className={`font-bold ${item.spotsLeft <= 1 ? "text-amber-600 dark:text-amber-400" : "text-yellow-600 dark:text-yellow-400"}`}
                        >
                          {item.spotsLeft}
                        </span>{" "}
                        post{item.spotsLeft === 1 ? "o" : "i"} rimast{item.spotsLeft === 1 ? "o" : "i"} su {item.capacity}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => decideApproval(item, "APPROVED")}
                        disabled={busyId === item.id}
                        aria-label="Approva"
                        title="Approva"
                        className="flex h-11 w-11 items-center justify-center bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => decideApproval(item, "REJECTED")}
                        disabled={busyId === item.id}
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
                ) : (
                  <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-neutral-900 dark:text-white">
                        {item.client.firstName} {item.client.lastName}
                      </div>
                      <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        Spostamento richiesto - {item.appointmentType.name}
                      </div>
                      <div className="mt-0.5 text-sm font-bold capitalize text-blue-600 dark:text-blue-400">
                        {formatDateTime(item.startTime)}
                      </div>
                      {item.reason && <div className="mt-1 text-xs italic text-neutral-500 dark:text-neutral-400">&quot;{item.reason}&quot;</div>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => decideReschedule(item, "APPROVE")}
                        disabled={busyId === item.id}
                        aria-label="Approva spostamento"
                        title="Approva spostamento"
                        className="flex h-11 w-11 items-center justify-center bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => decideReschedule(item, "REJECT")}
                        disabled={busyId === item.id}
                        aria-label="Rifiuta spostamento"
                        title="Rifiuta spostamento"
                        className="flex h-11 w-11 items-center justify-center bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              )}

              {visibleInformational.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      {TYPE_LABEL[item.type]}
                    </div>
                    <div className="truncate font-medium text-neutral-900 dark:text-white">
                      {item.type === "reminder_due" ? item.title : `${item.client.firstName} ${item.client.lastName}`}
                    </div>
                    {item.appointmentType && (
                      <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{item.appointmentType.name}</div>
                    )}
                    <div className="mt-0.5 text-sm capitalize text-neutral-600 dark:text-neutral-300">{formatDateTime(item.startTime)}</div>
                  </div>
                  <button
                    onClick={() => dismiss(item.id)}
                    aria-label="Rimuovi notifica"
                    title="Rimuovi notifica"
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {totalCount > 0 && (
              <Link
                href="/admin"
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
