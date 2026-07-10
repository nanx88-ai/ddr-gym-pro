"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import {
  btnDanger,
  btnNeutral,
  btnPositive,
  card,
  checkbox,
  input,
  pageSubtitle,
  pageTitle,
  tableHeadBg,
  tableWrap,
  td,
  th,
  trBorder,
} from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import AttendanceToggle from "@/components/AttendanceToggle";

interface RescheduleRequest {
  id: string;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string | null;
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  isRecurring: boolean;
  source: string;
  attended: boolean | null;
  client: {
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
  appointmentType: { name: string };
  rescheduleRequests: RescheduleRequest[];
}

const STATUS_OPTIONS = [
  { value: "", label: "Tutti gli stati" },
  { value: "PENDING_APPROVAL", label: "In attesa" },
  { value: "APPROVED", label: "Confermate" },
  { value: "REJECTED", label: "Rifiutate" },
  { value: "CANCELLED", label: "Annullate" },
  { value: "RESCHEDULE_REQUESTED", label: "Spostamento richiesto" },
  { value: "RESCHEDULED", label: "Riprogrammate" },
];

type SortBy = "date" | "status";
type SortDir = "asc" | "desc";

const filterField = `${input} w-full`;

export default function AdminBookingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pendingFirst, setPendingFirst] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/admin/bookings${filter ? `?status=${filter}` : ""}`,
    );
    const json = await res.json();
    setBookings(json.bookings ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status) {
      setFilter(status);
      setFiltersOpen(true);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const visibleBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? bookings.filter((b) =>
          `${b.client.firstName} ${b.client.lastName} ${b.client.email}`
            .toLowerCase()
            .includes(q),
        )
      : bookings;

    return [...filtered].sort((a, b) => {
      if (pendingFirst) {
        const ap = a.status === "PENDING_APPROVAL" ? 0 : 1;
        const bp = b.status === "PENDING_APPROVAL" ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "date") {
        return (
          dir *
          (new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        );
      }
      return dir * a.status.localeCompare(b.status);
    });
  }, [bookings, search, sortBy, sortDir, pendingFirst]);

  const activeFilterCount =
    (filter ? 1 : 0) +
    (sortBy !== "date" ? 1 : 0) +
    (sortDir !== "asc" ? 1 : 0) +
    (!pendingFirst ? 1 : 0);

  const DISRUPTIVE_CONFIRM: Record<string, string> = {
    REJECTED: "Rifiutare questa richiesta di prenotazione?",
    CANCELLED: "Annullare questa prenotazione?",
  };
  const STATUS_TOAST: Record<string, string> = {
    APPROVED: "Prenotazione approvata.",
    REJECTED: "Prenotazione rifiutata.",
    CANCELLED: "Prenotazione annullata.",
  };

  async function updateStatus(id: string, status: string) {
    const confirmMsg = DISRUPTIVE_CONFIRM[status];
    if (confirmMsg && !(await confirm(confirmMsg))) return;
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast.success(STATUS_TOAST[status] ?? "Stato aggiornato.");
    load();
  }

  async function markAttendance(id: string, attended: boolean | null) {
    await fetch(`/api/admin/bookings/${id}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended }),
    });
    toast.success(
      attended === false ? "Assenza segnata." : "Presenza aggiornata.",
    );
    load();
  }

  async function decideReschedule(
    requestId: string,
    decision: "APPROVE" | "REJECT",
  ) {
    if (
      decision === "REJECT" &&
      !(await confirm("Rifiutare questa richiesta di spostamento?"))
    )
      return;
    const res = await fetch(`/api/admin/reschedule/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Errore durante l'operazione.");
      return;
    }
    toast.success(
      decision === "APPROVE"
        ? "Spostamento approvato."
        : "Spostamento rifiutato.",
    );
    load();
  }

  function RescheduleBanner({ b }: { b: Booking }) {
    const req = b.rescheduleRequests[0];
    if (b.status !== "RESCHEDULE_REQUESTED" || !req) return null;
    return (
      <div className="mt-3 border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
        <p className="text-blue-800 dark:text-blue-300">
          Richiesta nuovo orario:{" "}
          <span className="font-medium capitalize">
            {formatDateTime(req.requestedStartTime)}
          </span>
        </p>
        {req.reason && (
          <p className="mt-0.5 text-xs italic text-blue-700 dark:text-blue-400">
            &quot;{req.reason}&quot;
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => decideReschedule(req.id, "APPROVE")}
            className={btnPositive}
          >
            Approva spostamento
          </button>
          <button
            onClick={() => decideReschedule(req.id, "REJECT")}
            className={btnDanger}
          >
            Rifiuta spostamento
          </button>
        </div>
      </div>
    );
  }

  function Actions({ b }: { b: Booking }) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {b.status === "PENDING_APPROVAL" && (
          <>
            <button
              onClick={() => updateStatus(b.id, "APPROVED")}
              className={btnPositive}
            >
              Approva
            </button>
            <button
              onClick={() => updateStatus(b.id, "REJECTED")}
              className={btnDanger}
            >
              Rifiuta
            </button>
          </>
        )}
        {["APPROVED", "RESCHEDULED", "RESCHEDULE_REQUESTED"].includes(
          b.status,
        ) && (
          <>
            <button
              onClick={() => updateStatus(b.id, "CANCELLED")}
              className={btnNeutral}
            >
              Annulla
            </button>
            <AttendanceToggle
              attended={b.attended}
              onChange={(attended) => markAttendance(b.id, attended)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className={pageTitle}>Prenotazioni</h1>
      <p className={pageSubtitle}>
        Approva, rifiuta o annulla le richieste ricevute.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, cognome o email..."
          className={`${input} flex-1 sm:max-w-xs`}
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-1.5 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          Filtri
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center bg-yellow-400 px-1 text-[10px] font-semibold text-neutral-900">
              {activeFilterCount}
            </span>
          )}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 9l6 6 6-6"
            />
          </svg>
        </button>
      </div>

      {filtersOpen && (
        <div
          className={`${card} mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4`}
        >
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={filterField}
          >
            {STATUS_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={filterField}
          >
            <option value="date">Ordina per data</option>
            <option value="status">Ordina per stato</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className={`${filterField} flex items-center justify-center gap-1.5 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700`}
          >
            {sortDir === "asc" ? "↑ Crescente" : "↓ Decrescente"}
          </button>

          <label
            className={`${filterField} flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <input
              type="checkbox"
              checked={pendingFirst}
              onChange={(e) => setPendingFirst(e.target.checked)}
              className={checkbox}
            />
            In attesa in cima
          </label>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Caricamento...</p>}

      {!loading && visibleBookings.length === 0 && (
        <p
          className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}
        >
          Nessuna prenotazione.
        </p>
      )}

      {/* Mobile: schede, una per prenotazione (una tabella qui e'illeggibile su schermi stretti) */}
      {!loading && visibleBookings.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {visibleBookings.map((b) => (
            <div key={b.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-neutral-900 dark:text-white">
                    {b.client.firstName} {b.client.lastName}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {b.client.email}
                  </div>
                  {b.client.status === "PAUSED" && (
                    <span className="text-xs text-yellow-500 dark:text-yellow-400">
                      Cliente in pausa
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 px-2 py-1 text-xs font-medium ${STATUS_COLORS[b.status]}`}
                >
                  {STATUS_LABELS[b.status] ?? b.status}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-neutral-700 dark:text-neutral-200">
                  {b.appointmentType.name}
                </span>
                <span className="capitalize text-neutral-500 dark:text-neutral-400">
                  {formatDateTime(b.startTime)}
                </span>
              </div>

              <RescheduleBanner b={b} />

              <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <Actions b={b} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {!loading && visibleBookings.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
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
              {visibleBookings.map((b) => (
                <tr key={b.id} className={trBorder}>
                  <td className={td}>
                    <div className="font-medium text-neutral-900 dark:text-white">
                      {b.client.firstName} {b.client.lastName}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {b.client.email}
                    </div>
                    {b.client.status === "PAUSED" && (
                      <span className="text-xs text-yellow-400">
                        Cliente in pausa
                      </span>
                    )}
                  </td>
                  <td className={td}>{b.appointmentType.name}</td>
                  <td className={`${td} capitalize`}>
                    {formatDateTime(b.startTime)}
                  </td>
                  <td className={td}>
                    <span
                      className={`px-2 py-1 text-xs font-medium ${STATUS_COLORS[b.status]}`}
                    >
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className={td}>
                    <Actions b={b} />
                    <RescheduleBanner b={b} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
