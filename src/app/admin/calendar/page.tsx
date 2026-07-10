"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  btnDanger,
  btnNeutral,
  btnPositive,
  btnPrimary,
  card,
  input,
} from "@/lib/ui";

interface AppointmentType {
  id: string;
  name: string;
  capacity: number;
}

interface DaySlot {
  time: string;
  startTime: string;
  endTime: string;
  capacity: number;
  defaultCapacity: number;
  isDisabled: boolean;
  overrideId: string | null;
  confirmed: number;
  pending: number;
  spotsLeft: number;
  bookings: {
    id: string;
    status: string;
    clientName: string;
    clientEmail: string;
  }[];
}

interface DayDetail {
  date: string;
  isOpen: boolean;
  note: string | null;
  slots: DaySlot[];
}

interface MonthDaySummary {
  date: string;
  isOpen: boolean;
  hasNote: boolean;
  totalSlots: number;
  disabledSlots: number;
  bookingsCount: number;
}

type ViewMode = "day" | "week" | "month";

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [view, setView] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetch("/api/admin/appointment-types?all=1")
      .then((res) => res.json())
      .then((json) => {
        setTypes(json.appointmentTypes ?? []);
        const fromQuery = searchParams.get("appointmentTypeId");
        if (fromQuery) {
          setAppointmentTypeId(fromQuery);
        } else if (json.appointmentTypes?.[0]) {
          setAppointmentTypeId(json.appointmentTypes[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToDay(d: Date) {
    setSelectedDate(d);
    setView("day");
  }

  function step(direction: 1 | -1) {
    if (view === "day") setSelectedDate((d) => addDays(d, direction));
    else if (view === "week") setSelectedDate((d) => addDays(d, direction * 7));
    else setSelectedDate((d) => addMonths(d, direction));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-bold text-neutral-900 dark:text-white">
            Calendario
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Vista giorno per giorno: disattiva o cambia la capienza di ogni
            singolo slot.
          </p>
        </div>
        <select
          value={appointmentTypeId}
          onChange={(e) => setAppointmentTypeId(e.target.value)}
          className={`${input} w-56`}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
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
          <button
            onClick={() => setSelectedDate(new Date())}
            className={btnNeutral}
          >
            Oggi
          </button>
          <button onClick={() => step(1)} className={btnNeutral}>
            &rarr;
          </button>
          <span className="ml-2 text-sm font-medium capitalize text-neutral-900 dark:text-white">
            {view === "month"
              ? format(selectedDate, "MMMM yyyy", { locale: it })
              : format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
          </span>
        </div>
      </div>

      {!appointmentTypeId && (
        <p className="text-sm text-neutral-500">
          Nessun calendario disponibile.
        </p>
      )}

      {appointmentTypeId && view === "day" && (
        <DayView appointmentTypeId={appointmentTypeId} date={selectedDate} />
      )}
      {appointmentTypeId && view === "week" && (
        <WeekView
          appointmentTypeId={appointmentTypeId}
          date={selectedDate}
          onSelectDay={goToDay}
        />
      )}
      {appointmentTypeId && view === "month" && (
        <MonthView
          appointmentTypeId={appointmentTypeId}
          date={selectedDate}
          onSelectDay={goToDay}
        />
      )}
    </div>
  );
}

function DayView({
  appointmentTypeId,
  date,
}: {
  appointmentTypeId: string;
  date: Date;
}) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/calendar/day?appointmentTypeId=${appointmentTypeId}&date=${dateKey(date)}`,
    );
    const json = await res.json();
    setDetail(json);
    setLoading(false);
  }, [appointmentTypeId, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleDisabled(slot: DaySlot) {
    setError(null);
    const res = await fetch("/api/admin/slot-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId,
        date: dateKey(date),
        time: slot.time,
        isDisabled: !slot.isDisabled,
        capacity: slot.overrideId ? slot.capacity : null,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante l'aggiornamento dello slot.");
      return;
    }
    load();
  }

  async function updateCapacity(slot: DaySlot, capacity: number) {
    if (capacity === slot.capacity) return;
    setError(null);
    const res = await fetch("/api/admin/slot-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId,
        date: dateKey(date),
        time: slot.time,
        isDisabled: slot.isDisabled,
        capacity,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante l'aggiornamento della capienza.");
      return;
    }
    load();
  }

  async function resetOverride(slot: DaySlot) {
    if (!slot.overrideId) return;
    await fetch(`/api/admin/slot-overrides/${slot.overrideId}`, {
      method: "DELETE",
    });
    load();
  }

  if (loading)
    return <p className="text-sm text-neutral-500">Caricamento...</p>;
  if (!detail) return null;

  if (!detail.isOpen) {
    return (
      <div
        className={`${card} p-6 text-center text-sm text-neutral-500 dark:text-neutral-400`}
      >
        Giorno chiuso{detail.note ? `: ${detail.note}` : "."}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}
      <div className={`${card} divide-y divide-neutral-800`}>
        {detail.slots.map((slot) => (
          <div
            key={slot.time}
            className={`flex flex-wrap items-center gap-3 p-3 ${slot.isDisabled ? "opacity-50" : ""}`}
          >
            <div className="w-16 font-mono text-sm font-medium text-neutral-900 dark:text-white">
              {slot.time}
            </div>

            <label className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              Capienza
              <input
                type="number"
                min={0}
                max={500}
                defaultValue={slot.capacity}
                onBlur={(e) => updateCapacity(slot, Number(e.target.value))}
                className={`${input} w-16 py-1`}
              />
              {slot.overrideId && slot.capacity !== slot.defaultCapacity && (
                <span className="text-yellow-400">
                  (default {slot.defaultCapacity})
                </span>
              )}
            </label>

            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              <span className="text-green-400">
                {slot.confirmed} confermati
              </span>
              {slot.pending > 0 && (
                <span className="ml-2 text-yellow-400">
                  {slot.pending} in attesa
                </span>
              )}
              <span className="ml-2">{slot.spotsLeft} liberi</span>
            </div>

            {slot.bookings.length > 0 && (
              <div className="text-xs text-neutral-500">
                {slot.bookings.map((b) => b.clientName).join(",")}
              </div>
            )}

            <div className="ml-auto flex gap-2">
              {slot.overrideId && (
                <button
                  onClick={() => resetOverride(slot)}
                  className={btnNeutral}
                >
                  Ripristina
                </button>
              )}
              <button
                onClick={() => toggleDisabled(slot)}
                className={slot.isDisabled ? btnPositive : btnDanger}
              >
                {slot.isDisabled ? "Riattiva slot" : "Disattiva slot"}
              </button>
            </div>
          </div>
        ))}
        {detail.slots.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">
            Nessuno slot generato per questo giorno.
          </p>
        )}
      </div>
    </div>
  );
}

function WeekView({
  appointmentTypeId,
  date,
  onSelectDay,
}: {
  appointmentTypeId: string;
  date: Date;
  onSelectDay: (d: Date) => void;
}) {
  const [days, setDays] = useState<DayDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    });

    setLoading(true);
    Promise.all(
      weekDays.map((d) =>
        fetch(
          `/api/admin/calendar/day?appointmentTypeId=${appointmentTypeId}&date=${dateKey(d)}`,
        ).then((res) => res.json()),
      ),
    ).then((results) => {
      setDays(results);
      setLoading(false);
    });
  }, [appointmentTypeId, date]);

  if (loading)
    return <p className="text-sm text-neutral-500">Caricamento...</p>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const d = new Date(day.date);
        return (
          <button
            key={day.date}
            onClick={() => onSelectDay(d)}
            className={`${card} p-3 text-left transition-colors hover:border-yellow-400 ${
              isToday(d) ? "border-yellow-400" : ""
            }`}
          >
            <div className="mb-2 text-sm font-medium capitalize text-neutral-900 dark:text-white">
              {format(d, "EEEE d", { locale: it })}
            </div>
            {!day.isOpen ? (
              <div className="text-xs text-neutral-500">
                Chiuso{day.note ? `: ${day.note}` : ""}
              </div>
            ) : (
              <div className="space-y-1">
                {day.slots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`flex items-center justify-between px-1.5 py-0.5 text-xs ${
                      slot.isDisabled
                        ? "bg-neutral-200 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-500"
                        : slot.spotsLeft === 0
                          ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                          : slot.pending > 0
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300"
                            : "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                    }`}
                  >
                    <span>{slot.time}</span>
                    <span>
                      {slot.isDisabled
                        ? "off"
                        : `${slot.spotsLeft}/${slot.capacity}`}
                    </span>
                  </div>
                ))}
                {day.slots.length === 0 && (
                  <div className="text-xs text-neutral-600">Nessuno slot</div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MonthView({
  appointmentTypeId,
  date,
  onSelectDay,
}: {
  appointmentTypeId: string;
  date: Date;
  onSelectDay: (d: Date) => void;
}) {
  const [days, setDays] = useState<MonthDaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const monthParam = format(date, "yyyy-MM");
    fetch(
      `/api/admin/calendar/month?appointmentTypeId=${appointmentTypeId}&month=${monthParam}`,
    )
      .then((res) => res.json())
      .then((json) => {
        setDays(json.days ?? []);
        setLoading(false);
      });
  }, [appointmentTypeId, date]);

  if (loading)
    return <p className="text-sm text-neutral-500">Caricamento...</p>;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-2 text-center text-xs font-medium text-neutral-500">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {gridDays.map((d) => {
          const summary = byDate.get(dateKey(d));
          const inMonth = isSameMonth(d, date);
          return (
            <button
              key={dateKey(d)}
              onClick={() => onSelectDay(d)}
              className={`${card} flex h-20 flex-col items-start p-2 text-left transition-colors hover:border-yellow-400 ${
                !inMonth ? "opacity-30" : ""
              } ${isToday(d) ? "border-yellow-400" : ""} ${isSameDay(d, date) ? "ring-1 ring-yellow-400" : ""}`}
            >
              <span className="text-xs font-medium text-neutral-900 dark:text-white">
                {format(d, "d")}
              </span>
              {summary && summary.isOpen ? (
                <span className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {summary.bookingsCount > 0 && (
                    <span className="text-green-400">
                      {summary.bookingsCount} pren.
                    </span>
                  )}
                  {summary.disabledSlots > 0 && (
                    <span className="block text-red-400">
                      {summary.disabledSlots} off
                    </span>
                  )}
                </span>
              ) : (
                <span className="mt-1 text-[11px] text-neutral-600">
                  chiuso
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminCalendarPage() {
  return (
    <Suspense>
      <CalendarPageContent />
    </Suspense>
  );
}
