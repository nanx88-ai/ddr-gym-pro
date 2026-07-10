"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatTime } from "@/lib/format";
import { publicCard, publicInput, publicLabel, publicBtnPrimary, publicBtnSecondary } from "@/lib/public-ui";
import { expandWeeklyOccurrences, occurrenceCountEndDate, toIsoDate, WEEKDAY_LABELS_FULL } from "@/lib/recurrence";
import MonthCalendar from "@/components/MonthCalendar";

interface Slot {
  startTime: string;
  endTime: string;
  capacity: number;
  confirmed: number;
  pending: number;
  spotsLeft: number;
  full: boolean;
}

interface AppointmentTypeAvailability {
  appointmentTypeId: string;
  name: string;
  durationMinutes: number;
  requiresApproval: boolean;
  closedNote: string | null;
  slots: Slot[];
}

interface AppointmentTypeMeta {
  id: string;
  name: string;
  durationMinutes: number;
  requiresApproval: boolean;
}

interface PickedSlot {
  key: string;
  startTime: string;
  endTime: string;
  recurring: boolean;
  endMethod: "count" | "date";
  count: number;
  endDate: string;
  confirmed: boolean;
}

function todayIso() {
  return toIsoDate(new Date());
}

function hasConsecutiveRun(slots: PickedSlot[], minLen = 3) {
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].endTime === sorted[i].startTime) {
      run++;
      if (run >= minLen) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

export default function HomePage() {
  const [step, setStep] = useState(1);

  const [types, setTypes] = useState<AppointmentTypeMeta[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const [date, setDate] = useState<string | null>(null);
  const [monthFullDates, setMonthFullDates] = useState<Set<string>>(new Set());

  const [dayAvailability, setDayAvailability] = useState<AppointmentTypeAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [pickedSlots, setPickedSlots] = useState<PickedSlot[]>([]);
  const [consecutiveConfirmed, setConsecutiveConfirmed] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const selectedType = types.find((t) => t.id === selectedTypeId) ?? null;

  useEffect(() => {
    fetch(`/api/availability?date=${todayIso()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`);
        return json;
      })
      .then((json) => {
        const list: AppointmentTypeAvailability[] = json.appointmentTypes ?? [];
        setTypes(
          list.map((t) => ({
            id: t.appointmentTypeId,
            name: t.name,
            durationMinutes: t.durationMinutes,
            requiresApproval: t.requiresApproval,
          }))
        );
      })
      .catch((err) => setLoadError(err.message ?? "Errore di caricamento"))
      .finally(() => setLoadingTypes(false));
  }, []);

  function loadMonth(monthIso: string) {
    if (!selectedTypeId) return;
    fetch(`/api/availability/month?month=${monthIso}&appointmentTypeId=${selectedTypeId}`)
      .then((res) => res.json())
      .then((json) => {
        const full = new Set<string>((json.days ?? []).filter((d: { full: boolean }) => d.full).map((d: { date: string }) => d.date));
        setMonthFullDates(full);
      });
  }

  useEffect(() => {
    if (step !== 3 || !date || !selectedTypeId) return;
    setLoadingAvailability(true);
    fetch(`/api/availability?date=${date}`)
      .then((res) => res.json())
      .then((json) => {
        const list: AppointmentTypeAvailability[] = json.appointmentTypes ?? [];
        setDayAvailability(list.find((t) => t.appointmentTypeId === selectedTypeId) ?? null);
      })
      .finally(() => setLoadingAvailability(false));
  }, [date, selectedTypeId, step]);

  function selectService(id: string) {
    setSelectedTypeId(id);
    setDate(null);
    setPickedSlots([]);
    setStep(2);
  }

  function selectDate(iso: string) {
    setDate(iso);
    setPickedSlots([]);
    setConsecutiveConfirmed(false);
    setStep(3);
  }

  function togglePickedSlot(slot: Slot) {
    setPickedSlots((prev) => {
      if (prev.some((p) => p.key === slot.startTime)) return prev.filter((p) => p.key !== slot.startTime);
      return [
        ...prev,
        {
          key: slot.startTime,
          startTime: slot.startTime,
          endTime: slot.endTime,
          recurring: false,
          endMethod: "count",
          count: 6,
          endDate: "",
          confirmed: false,
        },
      ];
    });
    setConsecutiveConfirmed(false);
  }

  function updatePickedSlot(key: string, patch: Partial<PickedSlot>) {
    setPickedSlots((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  const dayOfWeek = date ? new Date(`${date}T00:00:00`).getDay() : 0;
  const weekdayFull = WEEKDAY_LABELS_FULL[dayOfWeek];

  function occurrencesFor(p: PickedSlot) {
    if (!date || !p.recurring) return [];
    const end = p.endMethod === "count" ? occurrenceCountEndDate(date, p.count) : p.endDate;
    if (!end) return [];
    const time = new Date(p.startTime).toTimeString().slice(0, 5);
    return expandWeeklyOccurrences(dayOfWeek, date, end, time);
  }

  const consecutiveWarning = hasConsecutiveRun(pickedSlots);
  const canContinueStep3 =
    pickedSlots.length > 0 &&
    pickedSlots.every((p) => !p.recurring || p.confirmed) &&
    (!consecutiveWarning || consecutiveConfirmed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType) return;
    setSubmitting(true);
    setSubmitError(null);

    const items = pickedSlots.flatMap((p) => {
      if (!p.recurring) {
        return [{ appointmentTypeId: selectedType.id, startTime: p.startTime, endTime: p.endTime }];
      }
      return occurrencesFor(p).map((start) => ({
        appointmentTypeId: selectedType.id,
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + selectedType.durationMinutes * 60000).toISOString(),
        isRecurring: true,
        recurrenceGroupId: p.key,
      }));
    });

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, phone, notes, items }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok && (!json.bookings || json.bookings.length === 0)) {
      setSubmitError(json.error ?? "Errore durante la prenotazione.");
      return;
    }

    setResult({ created: json.bookings?.length ?? 0, failed: json.errors?.length ?? 0 });
  }

  const summaryItems = useMemo(() => {
    if (!selectedType) return [];
    return pickedSlots.flatMap((p) =>
      p.recurring
        ? occurrencesFor(p).map((start) => ({ name: selectedType.name, start }))
        : [{ name: selectedType.name, start: new Date(p.startTime) }]
    );
  }, [pickedSlots, selectedType, date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (result) {
    const allOk = result.failed === 0;
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 dark:bg-neutral-950">
        <div className={`${publicCard} w-full max-w-md p-6 text-center sm:p-8`}>
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
              allOk ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"
            }`}
          >
            {allOk ? "✅" : "⚠️"}
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
            {result.created} prenotazion{result.created === 1 ? "e" : "i"} inviat{result.created === 1 ? "a" : "e"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {result.failed > 0
              ? `${result.failed} slot non erano piu' disponibili e sono stati saltati.`
              : "Riceverai una conferma via email."}
          </p>
          <Link href="/" className={`mt-6 ${publicBtnPrimary}`} onClick={() => window.location.reload()}>
            Nuova prenotazione
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-5">
          <span className="text-base font-semibold text-neutral-900 dark:text-white">Palestra</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:px-5 sm:pb-8 sm:pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
          Prenota il tuo allenamento
        </h1>

        {step === 1 && (
          <div className="mt-6 space-y-3">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => selectService(t.id)}
                className={`${publicCard} flex w-full items-center justify-between p-4 text-left transition-colors hover:border-yellow-400`}
              >
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">{t.name}</div>
                  <div className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                    {t.durationMinutes} minuti
                    {t.requiresApproval && " · su approvazione"}
                  </div>
                </div>
                <span className="text-neutral-300 dark:text-neutral-600">&rarr;</span>
              </button>
            ))}
            {loadError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                {loadError}
              </p>
            )}
            {!loadError && !loadingTypes && types.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun servizio disponibile al momento.</p>
            )}
          </div>
        )}

        {step === 2 && selectedType && (
          <div className="mt-6">
            <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
              Servizio: <span className="font-medium text-neutral-800 dark:text-neutral-200">{selectedType.name}</span>
            </p>
            <div className={`${publicCard} p-3 sm:p-4`}>
              <MonthCalendar selected={date} onSelect={selectDate} fullDates={monthFullDates} onMonthChange={loadMonth} />
            </div>
          </div>
        )}

        {step === 3 && date && selectedType && (
          <div className="mt-6">
            <p className="mb-4 text-sm font-medium capitalize text-neutral-600 dark:text-neutral-300">
              {selectedType.name} ·{" "}
              {new Date(`${date}T00:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>

            {loadingAvailability && <div className={`${publicCard} h-32 animate-pulse`} />}

            {!loadingAvailability && dayAvailability && dayAvailability.slots.length === 0 && (
              <div className={`${publicCard} p-4 text-sm text-neutral-500 dark:text-neutral-400`}>
                {dayAvailability.closedNote ? `Chiuso: ${dayAvailability.closedNote}` : "Nessuno slot disponibile in questo giorno."}
              </div>
            )}

            {!loadingAvailability && dayAvailability && dayAvailability.slots.length > 0 && (
              <div className={`${publicCard} p-4 sm:p-5`}>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {dayAvailability.slots.map((slot) => {
                    const isPicked = pickedSlots.some((p) => p.key === slot.startTime);
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={slot.full}
                        onClick={() => togglePickedSlot(slot)}
                        className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                          slot.full
                            ? "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
                            : isPicked
                              ? "border-yellow-400 bg-yellow-400 text-neutral-900"
                              : "border-neutral-200 bg-white text-neutral-900 hover:border-yellow-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-yellow-400"
                        }`}
                      >
                        <div className="text-sm font-semibold">{formatTime(slot.startTime)}</div>
                        <div
                          className={`mt-0.5 text-[11px] ${
                            slot.full
                              ? "text-neutral-300 dark:text-neutral-600"
                              : isPicked
                                ? "text-neutral-700"
                                : slot.pending > 0
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                          }`}
                        >
                          {slot.full ? "Al completo" : `${slot.spotsLeft} liber${slot.spotsLeft === 1 ? "o" : "i"}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {consecutiveWarning && !consecutiveConfirmed && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-neutral-800 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-neutral-100">
                <p>Stai richiedendo la prenotazione di piu&apos; di 2 slot consecutivi. Sei sicuro?</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setConsecutiveConfirmed(true)} className={publicBtnPrimary}>
                    Si
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickedSlots((prev) => prev.slice(0, -1))}
                    className={publicBtnSecondary}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {pickedSlots.length > 0 && (
              <div className="mt-5 space-y-3">
                {pickedSlots
                  .slice()
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((p) => {
                    const occ = occurrencesFor(p);
                    const last = occ.at(-1);
                    return (
                      <div key={p.key} className={`${publicCard} p-4`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {formatTime(p.startTime)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPickedSlots((prev) => prev.filter((s) => s.key !== p.key))}
                            className="text-xs font-medium text-red-500 hover:underline"
                          >
                            Rimuovi
                          </button>
                        </div>

                        <div className="mt-2 flex gap-2 rounded-full border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
                          <button
                            type="button"
                            onClick={() => updatePickedSlot(p.key, { recurring: false, confirmed: false })}
                            className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                              !p.recurring ? "bg-yellow-400 text-neutral-900" : "text-neutral-500 dark:text-neutral-400"
                            }`}
                          >
                            Singola
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePickedSlot(p.key, { recurring: true, confirmed: false })}
                            className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                              p.recurring ? "bg-yellow-400 text-neutral-900" : "text-neutral-500 dark:text-neutral-400"
                            }`}
                          >
                            Ricorrente
                          </button>
                        </div>

                        {p.recurring && (
                          <div className="mt-3 space-y-3">
                            <div className="flex gap-4 text-xs">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={p.endMethod === "count"}
                                  onChange={() => updatePickedSlot(p.key, { endMethod: "count", confirmed: false })}
                                  className="h-5 w-5 accent-yellow-400"
                                />
                                Numero di volte
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={p.endMethod === "date"}
                                  onChange={() => updatePickedSlot(p.key, { endMethod: "date", confirmed: false })}
                                  className="h-5 w-5 accent-yellow-400"
                                />
                                Data di fine
                              </label>
                            </div>

                            {p.endMethod === "count" ? (
                              <label className="block">
                                <span className={publicLabel}>Quante volte</span>
                                <input
                                  type="number"
                                  min={2}
                                  max={52}
                                  value={p.count}
                                  onChange={(e) =>
                                    updatePickedSlot(p.key, { count: Number(e.target.value) || 2, confirmed: false })
                                  }
                                  className={publicInput}
                                />
                              </label>
                            ) : (
                              <label className="block">
                                <span className={publicLabel}>Fino al</span>
                                <input
                                  type="date"
                                  min={date}
                                  value={p.endDate}
                                  onChange={(e) => updatePickedSlot(p.key, { endDate: e.target.value, confirmed: false })}
                                  className={publicInput}
                                />
                              </label>
                            )}

                            {occ.length > 0 && !p.confirmed && (
                              <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-xs text-neutral-800 dark:border-yellow-900/50 dark:bg-yellow-900/10 dark:text-neutral-100">
                                <p>
                                  Stai richiedendo una prenotazione tutti i {weekdayFull} fino a {weekdayFull}{" "}
                                  {last?.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}, alle ore{" "}
                                  {formatTime(p.startTime)} ({occ.length} appuntamenti in totale). Sei sicuro?
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updatePickedSlot(p.key, { confirmed: true })}
                                    className={`${publicBtnPrimary} px-4 py-1.5 text-xs`}
                                  >
                                    Si
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updatePickedSlot(p.key, { recurring: false })}
                                    className={`${publicBtnSecondary} px-4 py-1.5 text-xs`}
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            )}

                            {p.confirmed && (
                              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                Confermato: {occ.length} appuntamenti fino a{" "}
                                {last?.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <form id="booking-details-form" onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className={`${publicCard} p-4 sm:p-5`}>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Riepilogo</h2>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-300">
                {summaryItems
                  .slice()
                  .sort((a, b) => a.start.getTime() - b.start.getTime())
                  .map((o, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{o.name}</span>
                      <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                        {o.start.toLocaleString("it-IT", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                {submitError}
              </div>
            )}

            <div className={`${publicCard} space-y-4 p-4 sm:p-5`}>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={publicLabel}>Nome</span>
                  <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={publicInput} />
                </label>
                <label className="block">
                  <span className={publicLabel}>Cognome</span>
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={publicInput} />
                </label>
              </div>
              <label className="block">
                <span className={publicLabel}>Email</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={publicInput} />
              </label>
              <label className="block">
                <span className={publicLabel}>Telefono (facoltativo)</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={publicInput} />
              </label>
              <label className="block">
                <span className={publicLabel}>Note (facoltativo)</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={publicInput} rows={3} />
              </label>
            </div>
          </form>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto flex max-w-2xl gap-3">
            {step > 1 && (
              <button onClick={() => setStep((s) => s - 1)} className={publicBtnSecondary}>
                Indietro
              </button>
            )}
            {step === 3 && (
              <button onClick={() => setStep(4)} disabled={!canContinueStep3} className={`flex-1 ${publicBtnPrimary}`}>
                Continua
              </button>
            )}
            {step === 4 && (
              <button type="submit" form="booking-details-form" disabled={submitting} className={`flex-1 ${publicBtnPrimary}`}>
                {submitting ? "Invio in corso..." : "Conferma prenotazione"}
              </button>
            )}
          </div>
        </div>

        <footer className="mt-16 hidden border-t border-neutral-200 pt-6 text-center dark:border-neutral-800 sm:block">
          <Link
            href="/admin/login"
            className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline dark:text-neutral-500 dark:hover:text-neutral-300"
          >
            Accesso staff
          </Link>
        </footer>
      </main>
    </div>
  );
}
