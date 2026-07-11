"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { btnNeutral, btnPositive, btnPrimary, card, input, label, pageSubtitle, pageTitle } from "@/lib/ui";
import { IconButton } from "@/components/IconAction";
import { Checkbox } from "@/components/Checkbox";

interface AppointmentType {
  id: string;
  name: string;
}

interface Band {
  key: string; // id lato server, o temp-N per fasce non ancora salvate
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ScheduleException {
  id: string;
  date: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  note: string | null;
}

// Lunedi' prima, domenica ultima (uso comune IT) - il valore dayOfWeek resta
// quello JS (0=Domenica...6=Sabato), cambia solo l'ordine di visualizzazione.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Domenica", "Lunedi'", "Martedi'", "Mercoledi'", "Giovedi'", "Venerdi'", "Sabato"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

/** Bottone quadrato compatto per azioni dentro le colonne/righe fascia (piu' piccolo dei 44px standard, qui il contesto e' denso). */
function AddSlotButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-yellow-400 text-base font-bold leading-none text-yellow-400 hover:bg-yellow-400/10"
    >
      +
    </button>
  );
}

function RemoveSlotButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center text-red-600 hover:text-red-500 dark:text-red-500"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M9 9l6 6M15 9l-6 6" />
      </svg>
    </button>
  );
}

let tempKeyCounter = 0;
function nextTempKey() {
  return `temp-${tempKeyCounter++}`;
}

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [bands, setBands] = useState<Band[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [excDate, setExcDate] = useState("");
  const [excClosed, setExcClosed] = useState(true);
  const [excOpenTime, setExcOpenTime] = useState("09:00");
  const [excCloseTime, setExcCloseTime] = useState("13:00");
  const [excNote, setExcNote] = useState("");

  const [newBand, setNewBand] = useState<{ dayOfWeek: number; startTime: string; endTime: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState(DAY_ORDER[0]);

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
    setBands((json.bands ?? []).map((b: { id: string; dayOfWeek: number; startTime: string; endTime: string }) => ({
      key: b.id,
      dayOfWeek: b.dayOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
    })));
  }

  async function loadExceptions(id: string) {
    const res = await fetch(`/api/admin/schedule/exceptions?appointmentTypeId=${id}`);
    const json = await res.json();
    setExceptions(json.exceptions ?? []);
  }

  function openAddBand(dayOfWeek: number) {
    const existing = bands.filter((b) => b.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const last = existing[existing.length - 1];
    const start = last ? last.endTime : "09:00";
    const [h, m] = start.split(":").map(Number);
    const endH = Math.min(23, h + 2);
    const end = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    setNewBand({ dayOfWeek, startTime: start, endTime: end });
  }

  async function confirmAddBand() {
    if (!newBand) return;
    const updated = [...bands, { key: nextTempKey(), ...newBand }];
    const ok = await saveSchedule(updated);
    if (ok) setNewBand(null);
  }

  async function removeBand(key: string) {
    const updated = bands.filter((b) => b.key !== key);
    await saveSchedule(updated);
  }

  /** Ogni modifica (aggiunta/rimozione fascia) salva subito: niente stato "non salvato" da tenere a mente. */
  async function saveSchedule(nextBands: Band[]) {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId,
        bands: nextBands.map((b) => ({ dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio.");
      return false;
    }
    await loadSchedule(appointmentTypeId);
    return true;
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
      {message && (
        <div className="mb-4 border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          {message}
        </div>
      )}

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Fasce orarie settimanali</h2>

        {/* Desktop/tablet: tutti i 7 giorni affiancati in colonne */}
        <div className="hidden gap-4 overflow-x-auto md:flex">
          {DAY_ORDER.map((dayOfWeek) => {
            const dayBands = bands.filter((b) => b.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={dayOfWeek} className="min-w-[130px] flex-1">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">{DAY_NAMES[dayOfWeek]}</span>
                  <AddSlotButton label="Aggiungi fascia" onClick={() => openAddBand(dayOfWeek)} />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {dayBands.length === 0 && (
                    <span className="py-2 text-center text-xs font-semibold uppercase text-neutral-400 dark:text-neutral-600">
                      Chiuso
                    </span>
                  )}
                  {dayBands.map((b) => (
                    <div
                      key={b.key}
                      className="flex items-center justify-between border border-neutral-200 bg-neutral-50 py-3 pl-3 pr-2 dark:border-neutral-800 dark:bg-neutral-900/60"
                    >
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
                        {b.startTime}&ndash;{b.endTime}
                      </span>
                      <RemoveSlotButton label="Rimuovi fascia" onClick={() => removeBand(b.key)} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: un giorno alla volta, selezionato da una barra di chip */}
        <div className="md:hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {DAY_ORDER.map((dayOfWeek) => (
              <button
                key={dayOfWeek}
                type="button"
                onClick={() => setSelectedDay(dayOfWeek)}
                className={`h-11 w-14 shrink-0 border-2 text-xs font-semibold uppercase transition-colors hover:bg-yellow-400/10 ${
                  selectedDay === dayOfWeek
                    ? "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400"
                    : "border-transparent bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                }`}
              >
                {DAY_SHORT[dayOfWeek]}
              </button>
            ))}
          </div>

          <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {bands
              .filter((b) => b.dayOfWeek === selectedDay)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((b) => (
                <div key={b.key} className="flex items-center justify-between py-3">
                  <span className="text-base font-medium text-neutral-800 dark:text-neutral-100">
                    {b.startTime}&ndash;{b.endTime}
                  </span>
                  <IconButton icon="remove" label="Rimuovi fascia" tone="danger" onClick={() => removeBand(b.key)} />
                </div>
              ))}
            {bands.filter((b) => b.dayOfWeek === selectedDay).length === 0 && (
              <p className="py-3 text-sm text-neutral-400 dark:text-neutral-600">Chiuso</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => openAddBand(selectedDay)}
            className="mt-3 w-full border border-dashed border-neutral-300 py-3 text-sm font-semibold text-yellow-600 dark:border-neutral-700 dark:text-yellow-400"
          >
            + Aggiungi fascia
          </button>
        </div>
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
          <button type="submit" className={btnPositive}>
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

      {newBand && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full border border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-900 sm:max-w-sm sm:pb-0">
            <div className="p-6">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Nuova fascia &mdash; {DAY_NAMES[newBand.dayOfWeek]}
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Inserisci l&apos;orario di inizio e fine.</p>

              <div className="mt-5 flex items-end gap-3">
                <label className="block flex-1">
                  <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Inizio</span>
                  <input
                    type="time"
                    value={newBand.startTime}
                    onChange={(e) => setNewBand({ ...newBand, startTime: e.target.value })}
                    className={input}
                  />
                </label>
                <span className="mb-2.5 shrink-0 text-neutral-500">&ndash;</span>
                <label className="block flex-1">
                  <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Fine</span>
                  <input
                    type="time"
                    value={newBand.endTime}
                    onChange={(e) => setNewBand({ ...newBand, endTime: e.target.value })}
                    className={input}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
              <button type="button" onClick={() => setNewBand(null)} className={`flex-1 ${btnNeutral}`}>
                Annulla
              </button>
              <button type="button" onClick={confirmAddBand} disabled={saving} className={`flex-1 ${btnPrimary}`}>
                {saving ? "Salvataggio..." : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
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
