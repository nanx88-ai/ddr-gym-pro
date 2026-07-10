"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { formatTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import {
  btnDanger,
  btnNeutral as btnGhost,
  btnPositive,
  card,
  input,
  pageSubtitle,
  pageTitle,
} from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import AttendanceToggle from "@/components/AttendanceToggle";
import { IconButton } from "@/components/IconAction";

interface AppointmentType {
  id: string;
  name: string;
  capacity: number;
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  attended: boolean | null;
  appointmentTypeId: string;
  client: { firstName: string; lastName: string; email: string };
  appointmentType: { name: string };
}

type ViewMode = "day" | "week" | "month";

const STATUS_OPTIONS = [
  { value: "", label: "Tutti gli stati" },
  { value: "PENDING_APPROVAL", label: "In attesa" },
  { value: "APPROVED", label: "Confermate" },
  { value: "REJECTED", label: "Rifiutate" },
  { value: "CANCELLED", label: "Annullate" },
  { value: "RESCHEDULED", label: "Riprogrammate" },
];

const ACTIVE_STATUSES = new Set(["PENDING_APPROVAL", "APPROVED", "RESCHEDULE_REQUESTED", "RESCHEDULED"]);

const TIME_OF_DAY_RANGES: Record<string, [number, number]> = {
  morning: [5, 12],
  afternoon: [12, 18],
  evening: [18, 24],
};

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function AdminAgendaPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [status, setStatus] = useState("");
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [search, setSearch] = useState("");
  const [fullness, setFullness] = useState(""); // "" | "full" | "available"
  const [attendance, setAttendance] = useState(""); // "" | "present" | "absent" | "unmarked"
  const [timeOfDay, setTimeOfDay] = useState(""); // "" | "morning" | "afternoon" | "evening"
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const activeFilterCount =
    (status ? 1 : 0) +
    (appointmentTypeId ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (fullness ? 1 : 0) +
    (attendance ? 1 : 0) +
    (timeOfDay ? 1 : 0);

  useEffect(() => {
    fetch("/api/admin/appointment-types?all=1")
      .then((res) => res.json())
      .then((json) => setTypes(json.appointmentTypes ?? []));
  }, []);

  const range = useMemo(() => {
    if (view === "day")
      return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
    if (view === "week")
      return {
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
      };
    return {
      start: startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 }),
    };
  }, [view, selectedDate]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    });
    if (status) params.set("status", status);
    if (appointmentTypeId) params.set("appointmentTypeId", appointmentTypeId);
    if (search.trim()) params.set("q", search.trim());

    fetch(`/api/admin/agenda?${params}`)
      .then((res) => res.json())
      .then((json) => setBookings(json.bookings ?? []))
      .finally(() => setLoading(false));
  }, [range, status, appointmentTypeId, search]);

  // Occupazione per singolo slot (appointmentTypeId+startTime), calcolata sui
  // dati gia' caricati per il periodo: usata dal filtro "pieno/con posti
  // liberi". Usa la capienza di default del servizio (non gli override
  // puntuali per singolo slot, non caricati qui).
  const occupancyBySlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (!ACTIVE_STATUSES.has(b.status)) continue;
      const key = `${b.appointmentTypeId}|${b.startTime}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [bookings]);

  const capacityByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of types) map.set(t.id, t.capacity);
    return map;
  }, [types]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (attendance === "present" && b.attended !== true) return false;
      if (attendance === "absent" && b.attended !== false) return false;
      if (attendance === "unmarked" && b.attended !== null) return false;

      if (timeOfDay) {
        const hour = new Date(b.startTime).getHours();
        const [from, to] = TIME_OF_DAY_RANGES[timeOfDay];
        if (hour < from || hour >= to) return false;
      }

      if (fullness) {
        const capacity = capacityByType.get(b.appointmentTypeId);
        const occupancy = occupancyBySlot.get(`${b.appointmentTypeId}|${b.startTime}`) ?? 0;
        if (capacity == null) return true;
        const isFull = occupancy >= capacity;
        if (fullness === "full" && !isFull) return false;
        if (fullness === "available" && isFull) return false;
      }

      return true;
    });
  }, [bookings, attendance, timeOfDay, fullness, capacityByType, occupancyBySlot]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filteredBookings) {
      const key = dateKey(new Date(b.startTime));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [filteredBookings]);

  function step(direction: 1 | -1) {
    if (view === "day") setSelectedDate((d) => addDays(d, direction));
    else if (view === "week") setSelectedDate((d) => addWeeks(d, direction));
    else setSelectedDate((d) => addMonths(d, direction));
  }

  function goToDay(d: Date) {
    setSelectedDate(d);
    setView("day");
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

  async function updateStatus(id: string, newStatus: string) {
    const confirmMsg = DISRUPTIVE_CONFIRM[newStatus];
    if (confirmMsg && !(await confirm(confirmMsg))) return;
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success(STATUS_TOAST[newStatus] ?? "Stato aggiornato.");
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)),
    );
  }

  async function markAttendance(id: string, attended: boolean) {
    await fetch(`/api/admin/bookings/${id}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended }),
    });
    toast.success(attended ? "Presenza aggiornata." : "Assenza segnata.");
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, attended } : b)),
    );
  }

  return (
    <div>
      <h1 className={pageTitle}>Agenda</h1>
      <p className={pageSubtitle}>
        Vista d&apos;insieme delle prenotazioni per giorno, settimana o mese.
      </p>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
          {(
            [
              { v: "day", icon: "viewDay", label: "Giorno" },
              { v: "week", icon: "viewWeek", label: "Settimana" },
              { v: "month", icon: "viewMonth", label: "Mese" },
            ] as const
          ).map(({ v, icon, label: viewLabel }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              title={viewLabel}
              aria-label={viewLabel}
              className={`flex h-11 w-11 items-center justify-center transition-colors ${
                view === v
                  ? "bg-yellow-400 text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                {icon === "viewDay" && (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 5.5h16M4 5.5v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-13M8 10h8M8 14h8"
                  />
                )}
                {icon === "viewWeek" && (
                  <>
                    <rect x="3.5" y="4.5" width="4" height="15" />
                    <rect x="10" y="4.5" width="4" height="15" />
                    <rect x="16.5" y="4.5" width="4" height="15" />
                  </>
                )}
                {icon === "viewMonth" && (
                  <>
                    <rect x="3.5" y="3.5" width="17" height="17" />
                    <path strokeLinecap="round" d="M3.5 9h17M3.5 14.5h17M9 3.5v17M14.5 3.5v17" />
                  </>
                )}
              </svg>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <IconButton icon="chevronLeft" label="Periodo precedente" onClick={() => step(-1)} />
          <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-neutral-900 dark:text-white sm:min-w-[13rem]">
            {view === "month"
              ? format(selectedDate, "MMMM yyyy", { locale: it })
              : view === "week"
                ? `${format(range.start, "d MMM", { locale: it })} - ${format(range.end, "d MMM yyyy", { locale: it })}`
                : format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
          </span>
          <IconButton icon="chevronRight" label="Periodo successivo" onClick={() => step(1)} />
          <IconButton icon="today" label="Vai a oggi" onClick={() => setSelectedDate(new Date())} />
        </div>
      </div>

      <div className="mb-3">
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
          className={`${card} mb-4 grid grid-cols-1 gap-2 p-3 sm:grid-cols-3`}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome o email..."
            className={`${input} w-full`}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${input} w-full`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={appointmentTypeId}
            onChange={(e) => setAppointmentTypeId(e.target.value)}
            className={`${input} w-full`}
          >
            <option value="">Tutti i servizi</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={fullness} onChange={(e) => setFullness(e.target.value)} className={`${input} w-full`}>
            <option value="">Pieni e con posti liberi</option>
            <option value="available">Solo con posti liberi</option>
            <option value="full">Solo pieni</option>
          </select>
          <select value={attendance} onChange={(e) => setAttendance(e.target.value)} className={`${input} w-full`}>
            <option value="">Presenza: tutte</option>
            <option value="present">Solo presenti</option>
            <option value="absent">Solo assenti</option>
            <option value="unmarked">Non ancora segnati</option>
          </select>
          <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className={`${input} w-full`}>
            <option value="">Tutta la giornata</option>
            <option value="morning">Mattina (5-12)</option>
            <option value="afternoon">Pomeriggio (12-18)</option>
            <option value="evening">Sera (18-24)</option>
          </select>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Caricamento...</p>}

      {!loading && view === "day" && (
        <DayList
          bookings={byDay.get(dateKey(selectedDate)) ?? []}
          onUpdateStatus={updateStatus}
          onMarkAttendance={markAttendance}
        />
      )}

      {!loading && view === "week" && (
        <WeekGrid
          rangeStart={range.start}
          byDay={byDay}
          onDayClick={goToDay}
          onUpdateStatus={updateStatus}
        />
      )}

      {!loading && view === "month" && (
        <MonthGrid month={selectedDate} byDay={byDay} onDayClick={goToDay} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DayList({
  bookings,
  onUpdateStatus,
  onMarkAttendance,
}: {
  bookings: Booking[];
  onUpdateStatus: (id: string, s: string) => void;
  onMarkAttendance: (id: string, attended: boolean) => void;
}) {
  if (bookings.length === 0) {
    return (
      <p
        className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}
      >
        Nessuna prenotazione per questo giorno.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {bookings
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((b) => (
          <div
            key={b.id}
            className={`${card} flex flex-wrap items-center justify-between gap-3 p-3`}
          >
            <div className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-sm font-semibold text-neutral-900 dark:text-white">
                {formatTime(b.startTime)}
              </span>
              <div>
                <div className="text-sm font-medium text-neutral-900 dark:text-white">
                  {b.client.firstName} {b.client.lastName}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {b.appointmentType.name} · {b.client.email}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={b.status} />
              {b.status === "PENDING_APPROVAL" && (
                <>
                  <button
                    onClick={() => onUpdateStatus(b.id, "APPROVED")}
                    className={btnPositive}
                  >
                    Approva
                  </button>
                  <button
                    onClick={() => onUpdateStatus(b.id, "REJECTED")}
                    className={btnDanger}
                  >
                    Rifiuta
                  </button>
                </>
              )}
              {["APPROVED", "RESCHEDULED"].includes(b.status) && (
                <>
                  <button
                    onClick={() => onUpdateStatus(b.id, "CANCELLED")}
                    className={btnGhost}
                  >
                    Annulla
                  </button>
                  <AttendanceToggle
                    attended={b.attended}
                    onChange={(attended) => onMarkAttendance(b.id, attended)}
                  />
                </>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

function WeekGrid({
  rangeStart,
  byDay,
  onDayClick,
}: {
  rangeStart: Date;
  byDay: Map<string, Booking[]>;
  onDayClick: (d: Date) => void;
  onUpdateStatus: (id: string, s: string) => void;
}) {
  const days = eachDayOfInterval({
    start: rangeStart,
    end: addDays(rangeStart, 6),
  });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((d) => {
        const key = dateKey(d);
        const items = (byDay.get(key) ?? [])
          .slice()
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={key} className={`${card} p-2`}>
            <button
              onClick={() => onDayClick(d)}
              className={`mb-2 flex w-full items-center justify-between px-1.5 py-1 text-left text-xs font-semibold uppercase transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                isToday(d)
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <span>{format(d, "EEE d", { locale: it })}</span>
              {items.length > 0 && (
                <span className="bg-neutral-200 px-1.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                  {items.length}
                </span>
              )}
            </button>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {items.map((b) => (
                <div
                  key={b.id}
                  className="border border-neutral-100 px-2 py-1 text-xs dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {formatTime(b.startTime)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="truncate text-neutral-600 dark:text-neutral-300">
                    {b.client.firstName} {b.client.lastName}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="px-1 text-xs text-neutral-400 dark:text-neutral-600">
                  -
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({
  month,
  byDay,
  onDayClick,
}: {
  month: Date;
  byDay: Map<string, Booking[]>;
  onDayClick: (d: Date) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500 sm:text-[11px]">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const key = dateKey(d);
          const items = byDay.get(key) ?? [];
          const pending = items.filter(
            (b) => b.status === "PENDING_APPROVAL",
          ).length;
          const inMonth = isSameMonth(d, month);
          return (
            <button
              key={key}
              onClick={() => onDayClick(d)}
              className={`flex min-h-20 flex-col items-start border p-2 text-left transition-colors sm:min-h-20 ${
                !inMonth
                  ? "border-transparent text-neutral-300 dark:text-neutral-700"
                  : isToday(d)
                    ? "border-yellow-400"
                    : "border-neutral-100 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-600"
              }`}
            >
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:text-xs">
                {d.getDate()}
              </span>
              {items.length > 0 && (
                <span className="mt-1 bg-neutral-200 px-1.5 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 sm:text-[10px]">
                  {items.length}
                </span>
              )}
              {pending > 0 && (
                <span
                  className="mt-1 h-2 w-2 bg-amber-500"
                  title={`${pending} in attesa`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
