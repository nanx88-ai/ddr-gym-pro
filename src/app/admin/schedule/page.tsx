"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { btnPrimary, card, input, label, pageSubtitle, pageTitle } from "@/lib/ui";
import { IconButton } from "@/components/IconAction";
import { Checkbox } from "@/components/Checkbox";
import { WeeklyScheduleEditor } from "@/components/WeeklyScheduleEditor";

interface AppointmentType {
  id: string;
  name: string;
}

interface ScheduleException {
  id: string;
  date: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  note: string | null;
}

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
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
    loadExceptions(appointmentTypeId);
  }, [appointmentTypeId]);

  async function loadExceptions(id: string) {
    const res = await fetch(`/api/admin/schedule/exceptions?appointmentTypeId=${id}`);
    const json = await res.json();
    setExceptions(json.exceptions ?? []);
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
    <div>
      <h1 className={pageTitle}>Fasce orarie</h1>
      <p className={pageSubtitle}>
        Quante fasce vuoi per ogni giorno (es. 06:00&ndash;08:00, 09:00&ndash;11:00, 13:00&ndash;16:00): i buchi tra
        una fascia e l&apos;altra non sono prenotabili, nessun giorno senza fasce e&apos; chiuso. Per bloccare o
        modificare un singolo slot (es. mercoledi&apos; 11 alle 10:00) usa il{" "}
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
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Fasce orarie settimanali</h2>
        {appointmentTypeId && <WeeklyScheduleEditor appointmentTypeId={appointmentTypeId} />}
      </section>

      <section className={`${card} p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Chiusure e orari per data specifica</h2>
        <p className="mb-3 text-xs text-neutral-500">Es. ferie, chiusura straordinaria, o orario ridotto per un giorno preciso.</p>

        <form onSubmit={addException} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Data</span>
            <input type="date" value={excDate} onChange={(e) => setExcDate(e.target.value)} className={`${input} w-40`} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700 dark:text-neutral-300">
            <Checkbox checked={excClosed} onChange={(e) => setExcClosed(e.target.checked)} />
            Giorno chiuso
          </label>
          {!excClosed && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Apertura</span>
                <input type="time" value={excOpenTime} onChange={(e) => setExcOpenTime(e.target.value)} className={`${input} w-28`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Chiusura</span>
                <input type="time" value={excCloseTime} onChange={(e) => setExcCloseTime(e.target.value)} className={`${input} w-28`} />
              </label>
            </>
          )}
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Nota (facoltativo)</span>
            <input value={excNote} onChange={(e) => setExcNote(e.target.value)} placeholder="es. Ferie estive" className={input} />
          </label>
          <button type="submit" className={btnPrimary}>
            Aggiungi
          </button>
        </form>

        <ul className="divide-y divide-neutral-800">
          {exceptions.map((exc) => (
            <li key={exc.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {new Date(exc.date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}
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
              <IconButton icon="delete" label="Rimuovi eccezione" tone="danger" onClick={() => removeException(exc.id)} />
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
