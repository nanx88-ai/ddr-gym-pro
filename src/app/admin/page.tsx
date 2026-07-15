"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import {
  btnDanger,
  btnPositive,
  card,
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
import { ActionsMenu } from "@/components/IconAction";
import EditBookingModal from "@/components/EditBookingModal";
import { Checkbox } from "@/components/Checkbox";
import { StatusDot } from "@/components/StatusDot";
import { SortableTh } from "@/components/SortableTh";
import { SortDirToggle } from "@/components/SortDirToggle";

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
  appointmentTypeId: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
  appointmentType: { name: string };
  rescheduleRequests: RescheduleRequest[];
}

interface AppointmentTypeOption {
  id: string;
  name: string;
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

type SortBy = "client" | "service" | "date";
type SortDir = "asc" | "desc";

const filterField = `${input} w-full min-w-0`;

export default function AdminBookingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortActive, setSortActive] = useState(false);
  const [pendingFirst, setPendingFirst] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [recurring, setRecurring] = useState(""); // "" | "yes" | "no"
  const [onlyRescheduleRequested, setOnlyRescheduleRequested] = useState(false);
  const [clientId, setClientId] = useState("");
  const [types, setTypes] = useState<AppointmentTypeOption[]>([]);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

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
    fetch("/api/admin/appointment-types?all=1")
      .then((res) => res.json())
      .then((json) => setTypes(json.appointmentTypes ?? []));
  }, []);

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

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) map.set(b.client.id, `${b.client.firstName} ${b.client.lastName}`);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [bookings]);

  const visibleBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = q
      ? bookings.filter((b) =>
          `${b.client.firstName} ${b.client.lastName} ${b.client.email}`
            .toLowerCase()
            .includes(q),
        )
      : bookings;

    if (dateFrom) filtered = filtered.filter((b) => b.startTime >= dateFrom);
    if (dateTo) filtered = filtered.filter((b) => b.startTime <= `${dateTo}T23:59:59`);
    if (appointmentTypeId) filtered = filtered.filter((b) => b.appointmentTypeId === appointmentTypeId);
    if (recurring) filtered = filtered.filter((b) => (recurring === "yes" ? b.isRecurring : !b.isRecurring));
    if (onlyRescheduleRequested) filtered = filtered.filter((b) => b.rescheduleRequests.length > 0);
    if (clientId) filtered = filtered.filter((b) => b.client.id === clientId);

    return [...filtered].sort((a, b) => {
      if (pendingFirst) {
        const ap = a.status === "PENDING_APPROVAL" ? 0 : 1;
        const bp = b.status === "PENDING_APPROVAL" ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "client") {
        return dir * `${a.client.firstName} ${a.client.lastName}`.localeCompare(`${b.client.firstName} ${b.client.lastName}`);
      }
      if (sortBy === "service") {
        return dir * a.appointmentType.name.localeCompare(b.appointmentType.name);
      }
      return (
        dir *
        (new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      );
    });
  }, [
    bookings,
    search,
    sortBy,
    sortDir,
    pendingFirst,
    dateFrom,
    dateTo,
    appointmentTypeId,
    recurring,
    onlyRescheduleRequested,
    clientId,
  ]);

  const activeFilterCount =
    (filter ? 1 : 0) +
    (!pendingFirst ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (appointmentTypeId ? 1 : 0) +
    (recurring ? 1 : 0) +
    (onlyRescheduleRequested ? 1 : 0) +
    (clientId ? 1 : 0);

  function resetFilters() {
    setFilter("");
    setAppointmentTypeId("");
    setClientId("");
    setDateFrom("");
    setDateTo("");
    setRecurring("");
    setOnlyRescheduleRequested(false);
    setPendingFirst(true);
  }

  function handleSort(key: SortBy) {
    setSortActive(true);
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

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
      attended === true
        ? "Segnato come presente."
        : attended === false
          ? "Segnato come assente."
          : "Segnato come n.d.",
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
    const canCancel =
      ["APPROVED", "RESCHEDULED", "RESCHEDULE_REQUESTED"].includes(b.status) && b.attended === null;
    const isPast = new Date(b.startTime).getTime() <= Date.now();
    const canMarkAttendance =
      ["APPROVED", "RESCHEDULED", "RESCHEDULE_REQUESTED"].includes(b.status) && isPast;

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canMarkAttendance && (
          <AttendanceToggle attended={b.attended} onChange={(attended) => markAttendance(b.id, attended)} />
        )}
        <ActionsMenu
          actions={[
            {
              key: "approve",
              icon: "activate",
              label: "Approva",
              tone: "positive",
              onClick: () => updateStatus(b.id, "APPROVED"),
              hidden: b.status !== "PENDING_APPROVAL",
            },
            {
              key: "reject",
              icon: "deactivate",
              label: "Rifiuta",
              tone: "danger",
              onClick: () => updateStatus(b.id, "REJECTED"),
              hidden: b.status !== "PENDING_APPROVAL",
            },
            {
              key: "edit",
              icon: "edit",
              label: "Modifica data/ora",
              onClick: () => setEditingBooking(b),
              hidden: !["PENDING_APPROVAL", "APPROVED", "RESCHEDULED"].includes(b.status),
            },
            {
              key: "cancel",
              icon: "remove",
              label: "Annulla",
              tone: "danger",
              onClick: () => updateStatus(b.id, "CANCELLED"),
              hidden: !canCancel,
            },
            {
              key: "mark-present",
              icon: "activate",
              label: "Segna come presente",
              onClick: () => markAttendance(b.id, true),
              hidden: !canMarkAttendance,
              disabled: b.attended === true,
            },
            {
              key: "mark-absent",
              icon: "deactivate",
              label: "Segna come assente",
              onClick: () => markAttendance(b.id, false),
              hidden: !canMarkAttendance,
              disabled: b.attended === false,
            },
            {
              key: "mark-unset",
              icon: "clear",
              label: "Rimuovi stato presenza",
              onClick: () => markAttendance(b.id, null),
              hidden: !canMarkAttendance,
              disabled: b.attended === null,
            },
          ]}
        />
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
          className="ml-auto flex min-h-11 shrink-0 items-center gap-1.5 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
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
        <div className={`${card} mb-4 grid grid-cols-1 gap-2 p-3 sm:grid-cols-3`}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={filterField}>
            {STATUS_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={filterField}>
            <option value="">Tutti i servizi</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={filterField}>
            <option value="">Tutti i clienti</option>
            {clientOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterField} placeholder="Dal" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterField} placeholder="Al" />

          <select value={recurring} onChange={(e) => setRecurring(e.target.value)} className={filterField}>
            <option value="">Ricorrenti e singole</option>
            <option value="yes">Solo ricorrenti</option>
            <option value="no">Solo singole</option>
          </select>

          <label
            className={`${input} w-full flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <Checkbox checked={pendingFirst} onChange={(e) => setPendingFirst(e.target.checked)} />
            In attesa in cima
          </label>

          <label
            className={`${input} w-full flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <Checkbox checked={onlyRescheduleRequested} onChange={(e) => setOnlyRescheduleRequested(e.target.checked)} />
            Solo con spostamento richiesto
          </label>

          {/* Da mobile non ci sono intestazioni di colonna cliccabili: stesso
              ordinamento delle colonne desktop via select + bottone direzione. */}
          <div className="flex gap-2 sm:hidden">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className={`${filterField} flex-1`}
            >
              <option value="date">Ordina per orario</option>
              <option value="client">Ordina per cliente</option>
              <option value="service">Ordina per servizio</option>
            </select>
            <SortDirToggle
              active={sortActive}
              dir={sortDir}
              onChange={({ active, dir }) => {
                setSortActive(active);
                setSortDir(dir);
              }}
            />
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-500 hover:border-red-400 hover:text-red-500 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-red-500 dark:hover:text-red-400"
            >
              Reset filtri
            </button>
          )}
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

      {/* Mobile: schede compatte a 3 righe (identita' / servizio / orario+azioni) */}
      {!loading && visibleBookings.length > 0 && (
        <div className="space-y-2 sm:hidden">
          {visibleBookings.map((b) => (
            <div key={b.id} className={`${card} space-y-1 px-4 py-3.5`}>
              <div className="flex items-center gap-2">
                <StatusDot status={b.status} />
                <Link
                  href={`/admin/clients/${b.client.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 truncate text-[15px] font-bold text-neutral-900 hover:text-yellow-600 dark:text-white dark:hover:text-yellow-400"
                >
                  {b.client.firstName} {b.client.lastName}
                </Link>
                {b.client.status === "PAUSED" && (
                  <span className="shrink-0 text-xs font-medium text-yellow-600 dark:text-yellow-400">In pausa</span>
                )}
              </div>
              <div className="text-[13px] text-neutral-600 dark:text-neutral-300">
                {b.appointmentType.name}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs capitalize text-neutral-500 dark:text-neutral-500">
                  {formatDateTime(b.startTime)}
                </span>
                <Actions b={b} />
              </div>

              <RescheduleBanner b={b} />
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
                <SortableTh label="Cliente" sortKey="client" active={sortBy === "client"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Servizio" sortKey="service" active={sortBy === "service"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Orario" sortKey="date" active={sortBy === "date"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {visibleBookings.map((b) => (
                <tr key={b.id} className={trBorder}>
                  <td className={td}>
                    <div className="flex items-start gap-2">
                      <StatusDot status={b.status} className="mt-1.5" />
                      <div>
                        <Link
                          href={`/admin/clients/${b.client.id}`}
                          className="font-medium text-neutral-900 hover:text-yellow-600 dark:text-white dark:hover:text-yellow-400"
                        >
                          {b.client.firstName} {b.client.lastName}
                        </Link>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {b.client.email}
                        </div>
                        {b.client.status === "PAUSED" && (
                          <span className="text-xs text-yellow-400">
                            Cliente in pausa
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={td}>{b.appointmentType.name}</td>
                  <td className={`${td} capitalize`}>
                    {formatDateTime(b.startTime)}
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

      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSaved={() => {
            setEditingBooking(null);
            load();
          }}
        />
      )}
    </div>
  );
}
