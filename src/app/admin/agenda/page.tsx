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
import { btnDanger, btnNeutral, btnNeutral as btnGhost, btnPositive, card, input, pageSubtitle, pageTitle } from "@/lib/ui";

interface AppointmentType {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
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

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function AdminAgendaPage() {
  const [view, setView] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [status, setStatus] = useState("");
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/appointment-types?all=1")
      .then((res) => res.json())
      .then((json) => setTypes(json.appointmentTypes ?? []));
  }, []);

  const range = useMemo(() => {
    if (view === "day") return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
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

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = dateKey(new Date(b.startTime));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [bookings]);

  function step(direction: 1 | -1) {
    if (view === "day") setSelectedDate((d) => addDays(d, direction));
    else if (view === "week") setSelectedDate((d) => addWeeks(d, direction));
    else setSelectedDate((d) => addMonths(d, direction));
  }

  function goToDay(d: Date) {
    setSelectedDate(d);
    setView("day");
  }

  async function updateStatus(id: string, newStatus: string) {
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
  }

  return (
    <div>
      <h1 className={pageTitle}>Agenda</h1>
      <p className={pageSubtitle}>Vista d&apos;insieme delle prenotazioni per giorno, settimana o mese.</p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                view === v
                  ? "bg-yellow-400 text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {v === "day" ? "Giorno" : v === "week" ? "Settimana" : "Mese"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} className={btnNeutral}>
            &larr;
          </button>
          <button onClick={() => setSelectedDate(new Date())} className={btnNeutral}>
            Oggi
          </button>
          <button onClick={() => step(1)} className={btnNeutral}>
            &rarr;
          </button>
          <span className="ml-1 text-sm font-medium capitalize text-neutral-900 dark:text-white">
            {view === "month"
              ? format(selectedDate, "MMMM yyyy", { locale: it })
              : view === "week"
                ? `${format(range.start, "d MMM", { locale: it })} - ${format(range.end, "d MMM yyyy", { locale: it })}`
                : format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
          </span>
        </div>
      </div>

      <div className={`${card} mb-4 grid grid-cols-1 gap-2 p-3 sm:grid-cols-3`}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, cognome o email..."
          className={`${input} w-full`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} w-full`}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={`${input} w-full`}>
          <option value="">Tutti i servizi</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-neutral-500">Caricamento...</p>}

      {!loading && view === "day" && (
        <DayList bookings={byDay.get(dateKey(selectedDate)) ?? []} onUpdateStatus={updateStatus} />
      )}

      {!loading && view === "week" && (
        <WeekGrid rangeStart={range.start} byDay={byDay} onDayClick={goToDay} onUpdateStatus={updateStatus} />
      )}

      {!loading && view === "month" && (
        <MonthGrid month={selectedDate} byDay={byDay} onDayClick={goToDay} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DayList({ bookings, onUpdateStatus }: { bookings: Booking[]; onUpdateStatus: (id: string, s: string) => void }) {
  if (bookings.length === 0) {
    return (
      <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
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
          <div key={b.id} className={`${card} flex flex-wrap items-center justify-between gap-3 p-3`}>
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
                  <button onClick={() => onUpdateStatus(b.id, "APPROVED")} className={btnPositive}>
                    Approva
                  </button>
                  <button onClick={() => onUpdateStatus(b.id, "REJECTED")} className={btnDanger}>
                    Rifiuta
                  </button>
                </>
              )}
              {["APPROVED", "RESCHEDULED"].includes(b.status) && (
                <button onClick={() => onUpdateStatus(b.id, "CANCELLED")} className={btnGhost}>
                  Annulla
                </button>
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
  const days = eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, 6) });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((d) => {
        const key = dateKey(d);
        const items = (byDay.get(key) ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={key} className={`${card} p-2`}>
            <button
              onClick={() => onDayClick(d)}
              className={`mb-2 flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs font-semibold uppercase transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                isToday(d) ? "text-yellow-600 dark:text-yellow-400" : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <span>{format(d, "EEE d", { locale: it })}</span>
              {items.length > 0 && (
                <span className="rounded-full bg-neutral-200 px-1.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                  {items.length}
                </span>
              )}
            </button>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {items.map((b) => (
                <div key={b.id} className="rounded-md border border-neutral-100 px-2 py-1 text-xs dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-neutral-900 dark:text-white">{formatTime(b.startTime)}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="truncate text-neutral-600 dark:text-neutral-300">
                    {b.client.firstName} {b.client.lastName}
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="px-1 text-xs text-neutral-400 dark:text-neutral-600">-</p>}
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
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium uppercase text-neutral-400 dark:text-neutral-500">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = dateKey(d);
          const items = byDay.get(key) ?? [];
          const pending = items.filter((b) => b.status === "PENDING_APPROVAL").length;
          const inMonth = isSameMonth(d, month);
          return (
            <button
              key={key}
              onClick={() => onDayClick(d)}
              className={`flex min-h-16 flex-col items-start rounded-lg border p-1.5 text-left transition-colors sm:min-h-20 ${
                !inMonth
                  ? "border-transparent text-neutral-300 dark:text-neutral-700"
                  : isToday(d)
                    ? "border-yellow-400"
                    : "border-neutral-100 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-600"
              }`}
            >
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{d.getDate()}</span>
              {items.length > 0 && (
                <span className="mt-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                  {items.length}
                </span>
              )}
              {pending > 0 && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" title={`${pending} in attesa`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
