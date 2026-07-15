"use client";

import { useEffect, useState } from "react";
import { input } from "@/lib/ui";
import { IconButton } from "@/components/IconAction";
import { Skeleton } from "@/components/Skeleton";

interface Band {
  key: string; // id lato server, o temp-N per fasce non ancora salvate
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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

/**
 * Fasce orarie settimanali di un servizio: griglia dei 7 giorni su
 * desktop/tablet, un giorno alla volta su mobile. Ogni aggiunta/rimozione
 * salva subito (sostituisce l'intero set via PUT /api/admin/schedule),
 * niente stato "non salvato" da tenere a mente. Riusato sia dentro
 * l'editor di un servizio (creazione/modifica) sia nella pagina Planning
 * per le chiusure/eccezioni per data specifica.
 */
export function WeeklyScheduleEditor({ appointmentTypeId }: { appointmentTypeId: string }) {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBand, setNewBand] = useState<{ dayOfWeek: number; startTime: string; endTime: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState(DAY_ORDER[0]);

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentTypeId]);

  async function loadSchedule() {
    setLoading(true);
    const res = await fetch(`/api/admin/schedule?appointmentTypeId=${appointmentTypeId}`);
    const json = await res.json();
    setBands(
      (json.bands ?? []).map((b: { id: string; dayOfWeek: number; startTime: string; endTime: string }) => ({
        key: b.id,
        dayOfWeek: b.dayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    );
    setLoading(false);
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

  async function saveSchedule(nextBands: Band[]) {
    setError(null);
    const res = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId,
        bands: nextBands.map((b) => ({ dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio.");
      return false;
    }
    await loadSchedule();
    return true;
  }

  if (loading) {
    return (
      <>
        <div className="hidden gap-4 md:flex">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40 min-w-[130px] flex-1" />
          ))}
        </div>
        <Skeleton className="h-40 w-full md:hidden" />
      </>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

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

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewBand(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={confirmAddBand}
                  className="border-2 border-yellow-400 bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-yellow-300"
                >
                  Aggiungi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
