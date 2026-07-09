"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { btnDanger, btnPositive, btnPrimary, card, input, label, pageSubtitle, pageTitle } from "@/lib/ui";

interface AppointmentType {
  id: string;
  name: string;
}

interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

interface ScheduleException {
  id: string;
  date: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  note: string | null;
}

const DAY_NAMES = ["Domenica", "Lunedi'", "Martedi'", "Mercoledi'", "Giovedi'", "Venerdi'", "Sabato"];

function defaultDays(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
    openTime: "09:00",
    closeTime: "17:00",
    breakStart: null,
    breakEnd: null,
  }));
}

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [days, setDays] = useState<DaySchedule[]>(defaultDays());
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [excDate, setExcDate] = useState("");
  const [excClosed, setExcClosed] = useState(true);
  const [excOpenTime, setExcOpenTime] = useState("09:00");
  const [excCloseTime, setExcCloseTime] = useState("13:00");
  const [excNote, setExcNote] = useState("");

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

  useEffect(() => {
    if (!appointmentTypeId) return;
    loadSchedule(appointmentTypeId);
    loadExceptions(appointmentTypeId);
  }, [appointmentTypeId]);

  async function loadSchedule(id: string) {
    const res = await fetch(`/api/admin/schedule?appointmentTypeId=${id}`);
    const json = await res.json();
    if (json.schedule?.length === 7) {
      setDays([...json.schedule].sort((a: DaySchedule, b: DaySchedule) => a.dayOfWeek - b.dayOfWeek));
    } else {
      setDays(defaultDays());
    }
  }

  async function loadExceptions(id: string) {
    const res = await fetch(`/api/admin/schedule/exceptions?appointmentTypeId=${id}`);
    const json = await res.json();
    setExceptions(json.exceptions ?? []);
  }

  function updateDay(dayOfWeek: number, patch: Partial<DaySchedule>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  }

  async function saveSchedule() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentTypeId, days }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio.");
      return;
    }
    setMessage("Orario settimanale salvato.");
  }

  async function addException(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!excDate) {
      setError("Seleziona una data.");
      return;
    }
    const res = await fetch("/api/admin/schedule/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId,
        date: excDate,
        isClosed: excClosed,
        openTime: excClosed ? undefined : excOpenTime,
        closeTime: excClosed ? undefined : excCloseTime,
        note: excNote || undefined,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio dell'eccezione.");
      return;
    }
    setExcDate("");
    setExcNote("");
    loadExceptions(appointmentTypeId);
  }

  async function removeException(id: string) {
    await fetch(`/api/admin/schedule/exceptions/${id}`, { method: "DELETE" });
    loadExceptions(appointmentTypeId);
  }

  return (
    <div className="max-w-3xl">
      <h1 className={pageTitle}>Orario settimanale</h1>
      <p className={pageSubtitle}>
        Orario ricorrente, pausa pranzo e chiusure per data specifica. Per bloccare o modificare un singolo slot (es.
        mercoledi&apos; 11 alle 10:00) usa il{" "}
        <a href={`/admin/calendar?appointmentTypeId=${appointmentTypeId}`} className="text-yellow-400 hover:underline">
          Calendario
        </a>
        .
      </p>

      <label className="mb-6 block max-w-xs">
        <span className={label}>Calendario/servizio</span>
        <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={input}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          {message}
        </div>
      )}

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Orario settimanale e pausa pranzo</h2>
        <div className="space-y-2">
          {days.map((day) => (
            <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-2 last:border-0">
              <label className="flex w-28 items-center gap-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={day.isOpen}
                  onChange={(e) => updateDay(day.dayOfWeek, { isOpen: e.target.checked })}
                />
                {DAY_NAMES[day.dayOfWeek]}
              </label>
              <input
                type="time"
                value={day.openTime}
                disabled={!day.isOpen}
                onChange={(e) => updateDay(day.dayOfWeek, { openTime: e.target.value })}
                className={`${input} w-28`}
              />
              <span className="text-neutral-500">&ndash;</span>
              <input
                type="time"
                value={day.closeTime}
                disabled={!day.isOpen}
                onChange={(e) => updateDay(day.dayOfWeek, { closeTime: e.target.value })}
                className={`${input} w-28`}
              />
              <span className="ml-2 text-xs text-neutral-500">Pausa pranzo</span>
              <input
                type="time"
                value={day.breakStart ?? ""}
                disabled={!day.isOpen}
                onChange={(e) =>
                  updateDay(day.dayOfWeek, {
                    breakStart: e.target.value || null,
                    breakEnd: e.target.value ? day.breakEnd ?? "14:00" : null,
                  })
                }
                className={`${input} w-28`}
              />
              <span className="text-neutral-500">&ndash;</span>
              <input
                type="time"
                value={day.breakEnd ?? ""}
                disabled={!day.isOpen || !day.breakStart}
                onChange={(e) => updateDay(day.dayOfWeek, { breakEnd: e.target.value || null })}
                className={`${input} w-28`}
              />
              {day.breakStart && (
                <button
                  onClick={() => updateDay(day.dayOfWeek, { breakStart: null, breakEnd: null })}
                  className="text-xs text-red-400 hover:underline"
                >
                  Rimuovi pausa
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={saveSchedule} disabled={saving || !appointmentTypeId} className={`mt-4 ${btnPrimary}`}>
          {saving ? "Salvataggio..." : "Salva orario settimanale"}
        </button>
      </section>

      <section className={`${card} p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Chiusure e pause per data specifica</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Es. ferie, chiusura straordinaria, o orario ridotto per un giorno preciso.
        </p>

        <form onSubmit={addException} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Data</span>
            <input type="date" value={excDate} onChange={(e) => setExcDate(e.target.value)} className={`${input} w-40`} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={excClosed} onChange={(e) => setExcClosed(e.target.checked)} />
            Giorno chiuso
          </label>
          {!excClosed && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Apertura</span>
                <input
                  type="time"
                  value={excOpenTime}
                  onChange={(e) => setExcOpenTime(e.target.value)}
                  className={`${input} w-28`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Chiusura</span>
                <input
                  type="time"
                  value={excCloseTime}
                  onChange={(e) => setExcCloseTime(e.target.value)}
                  className={`${input} w-28`}
                />
              </label>
            </>
          )}
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Nota (facoltativo)</span>
            <input
              value={excNote}
              onChange={(e) => setExcNote(e.target.value)}
              placeholder="es. Ferie estive"
              className={input}
            />
          </label>
          <button type="submit" className={btnPositive}>
            Aggiungi
          </button>
        </form>

        <ul className="divide-y divide-neutral-800">
          {exceptions.map((exc) => (
            <li key={exc.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {new Date(exc.date).toLocaleDateString("it-IT", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>{" "}
                {exc.isClosed ? (
                  <span className="text-neutral-500 dark:text-neutral-400">chiuso{exc.note ? ` — ${exc.note}` : ""}</span>
                ) : (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {exc.openTime}&ndash;{exc.closeTime}
                    {exc.note ? ` — ${exc.note}` : ""}
                  </span>
                )}
              </div>
              <button onClick={() => removeException(exc.id)} className={btnDanger}>
                Rimuovi
              </button>
            </li>
          ))}
          {exceptions.length === 0 && <li className="py-2 text-sm text-neutral-500">Nessuna eccezione futura.</li>}
        </ul>
      </section>
    </div>
  );
}

export default function AdminSchedulePage() {
  return (
    <Suspense>
      <SchedulePageContent />
    </Suspense>
  );
}
