"use client";

import { useMemo, useState } from "react";
import { btnNeutral, btnPrimary, card, errorBox, input, label } from "@/lib/ui";
import { Checkbox } from "@/components/Checkbox";
import { SegmentedToggle } from "@/components/SegmentedToggle";
import { ClientPicker, type ClientOption } from "@/components/ClientPicker";
import { NewClientFields, emptyNewClient, newClientIsValid, type NewClientState } from "@/components/NewClientFields";
import { formatCurrency } from "@/lib/format";
import { expandWeeklyOccurrences, occurrenceCountEndDate, WEEKDAY_LABELS_FULL } from "@/lib/recurrence";

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  unitPrice: number;
  active: boolean;
}

interface DayPattern {
  id: string;
  dayOfWeek: number;
  time: string;
}

interface GeneratedSlot {
  id: string;
  startTime: string;
  endTime: string;
}

interface AvailabilitySlot {
  startTime: string;
  spotsLeft: number;
  full: boolean;
}

type ClientMode = "existing" | "new";

let idCounter = 0;
function nextId() {
  return `sub-${idCounter++}`;
}

export function SubscriptionCreatorWizard({
  services,
  onClose,
  onCreated,
}: {
  services: ServiceOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [appointmentTypeId, setAppointmentTypeId] = useState(services[0]?.id ?? "");
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [newClient, setNewClient] = useState<NewClientState>(emptyNewClient());

  // Step 3: ricorrenza
  const [dayPatterns, setDayPatterns] = useState<DayPattern[]>([]);
  const [newDayOfWeek, setNewDayOfWeek] = useState(2); // martedi'
  const [newDayTime, setNewDayTime] = useState("10:00");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [terminationMode, setTerminationMode] = useState<"count" | "date">("count");
  const [sessionCount, setSessionCount] = useState(10);
  const [endDate, setEndDate] = useState("");
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(7);
  const [autoRenew, setAutoRenew] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);

  // Step 4: sedute generate, modificabili
  const [generatedSlots, setGeneratedSlots] = useState<GeneratedSlot[]>([]);
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, AvailabilitySlot[]>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services.find((s) => s.id === appointmentTypeId) ?? null;

  function addDayPattern() {
    setDayPatterns((prev) => [...prev, { id: nextId(), dayOfWeek: newDayOfWeek, time: newDayTime }]);
  }
  function removeDayPattern(id: string) {
    setDayPatterns((prev) => prev.filter((p) => p.id !== id));
  }

  function goToStep2Or3() {
    setError(null);
    if (!appointmentTypeId) {
      setError("Scegli un servizio ad abbonamento.");
      return;
    }
    if (clientMode === "existing") {
      if (!selectedClient) {
        setError("Scegli un cliente esistente, oppure passa a \"Nuovo cliente\".");
        return;
      }
      setStep(3);
    } else {
      setStep(2);
    }
  }

  function goToStep3FromNewClient() {
    setError(null);
    if (!newClientIsValid(newClient)) {
      setError("Nome, cognome ed email sono obbligatori.");
      return;
    }
    setStep(3);
  }

  /** Genera le sedute dalla ricorrenza scelta (uno o piu' giorni/orari) e passa al riepilogo. */
  async function goToSummary() {
    setError(null);
    if (!selectedService) return;
    if (dayPatterns.length === 0) {
      setError("Aggiungi almeno un giorno/orario ricorrente.");
      return;
    }
    if (!startDate) {
      setError("Scegli una data di inizio.");
      return;
    }
    if (terminationMode === "date" && !endDate) {
      setError("Scegli una data di scadenza, oppure passa a \"Numero di sedute\".");
      return;
    }

    // Orizzonte di generazione: in modalita' "numero di sedute" si usa un
    // orizzonte ampio (52 occorrenze per giorno, il tetto massimo della
    // funzione di espansione) e poi si taglia al conteggio richiesto.
    const horizonEnd = terminationMode === "date" ? endDate : occurrenceCountEndDate(startDate, 52);
    const durationMs = selectedService.durationMinutes * 60000;

    let allDates: Date[] = [];
    for (const p of dayPatterns) {
      allDates = allDates.concat(expandWeeklyOccurrences(p.dayOfWeek, startDate, horizonEnd, p.time));
    }
    allDates.sort((a, b) => a.getTime() - b.getTime());
    const limited = terminationMode === "count" ? allDates.slice(0, sessionCount) : allDates;

    if (limited.length === 0) {
      setError("Nessuna seduta generata: controlla giorni, orari e date.");
      return;
    }

    const slots: GeneratedSlot[] = limited.map((d) => ({
      id: nextId(),
      startTime: d.toISOString(),
      endTime: new Date(d.getTime() + durationMs).toISOString(),
    }));
    setGeneratedSlots(slots);
    setStep(4);

    // Controllo occupazione (informativo, non bloccante): una chiamata per data unica.
    const uniqueDates = Array.from(new Set(slots.map((s) => s.startTime.slice(0, 10))));
    setLoadingAvailability(true);
    try {
      const results = await Promise.all(
        uniqueDates.map((d) =>
          fetch(`/api/admin/availability?date=${d}&appointmentTypeId=${appointmentTypeId}`)
            .then((res) => res.json())
            .then((json) => [d, json.slots ?? []] as const)
            .catch(() => [d, []] as const),
        ),
      );
      setAvailabilityByDate(Object.fromEntries(results));
    } finally {
      setLoadingAvailability(false);
    }
  }

  function editGeneratedSlot(id: string, field: "date" | "time", value: string) {
    setGeneratedSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const durationMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
        const currentDate = s.startTime.slice(0, 10);
        const currentTime = s.startTime.slice(11, 16);
        const nextDate = field === "date" ? value : currentDate;
        const nextTime = field === "time" ? value : currentTime;
        if (!nextDate || !nextTime) return s;
        const nextStart = new Date(`${nextDate}T${nextTime}:00`);
        return { ...s, startTime: nextStart.toISOString(), endTime: new Date(nextStart.getTime() + durationMs).toISOString() };
      }),
    );
  }

  function removeGeneratedSlot(id: string) {
    setGeneratedSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function occupancyFor(slot: GeneratedSlot): AvailabilitySlot | null {
    const dateSlots = availabilityByDate[slot.startTime.slice(0, 10)];
    if (!dateSlots) return null;
    return dateSlots.find((s) => s.startTime.slice(11, 16) === slot.startTime.slice(11, 16)) ?? null;
  }

  const sortedGeneratedSlots = useMemo(
    () => [...generatedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [generatedSlots],
  );

  async function handleConfirm() {
    setError(null);
    if (sortedGeneratedSlots.length === 0) {
      setError("Aggiungi almeno una seduta prima di confermare.");
      return;
    }
    setSubmitting(true);

    const lastOccurrence = sortedGeneratedSlots[sortedGeneratedSlots.length - 1];
    const computedEndDate = terminationMode === "count" ? lastOccurrence.startTime.slice(0, 10) : endDate;

    const clientPayload =
      clientMode === "existing" && selectedClient
        ? { clientId: selectedClient.id }
        : {
            clientFirstName: newClient.firstName,
            clientLastName: newClient.lastName,
            clientEmail: newClient.email,
            clientPhone: newClient.phone || undefined,
            clientDateOfBirth: newClient.dateOfBirth || undefined,
            clientSex: newClient.sex || undefined,
          };

    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...clientPayload,
        appointmentTypeId,
        startDate,
        endDate: computedEndDate,
        autoRenew,
        renewMonths: autoRenew ? renewMonths : undefined,
        notifyDaysBefore,
        occurrences: sortedGeneratedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
      }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? "Errore durante la creazione.");
      return;
    }

    onCreated();
  }

  const stepLabel =
    step === 1 ? "servizio e cliente" : step === 2 ? "dati del nuovo cliente" : step === 3 ? "ricorrenza e durata" : "riepilogo e conferma";

  return (
    <div className={`${card} mt-6 mb-6 p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Nuovo abbonamento &mdash; passo {step} di 4 &middot; {stepLabel}</h2>
        <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          Chiudi
        </button>
      </div>

      {error && <div className={errorBox}>{error}</div>}

      {step === 1 && (
        <div className="mt-4 space-y-5">
          <label className="block">
            <span className={label}>Servizio (ad abbonamento)</span>
            <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={input}>
              {services.length === 0 && <option value="">Nessun servizio ad abbonamento configurato</option>}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatCurrency(s.unitPrice)}){s.active ? "" : " - disattivato"}
                </option>
              ))}
            </select>
            {services.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Nessun servizio e&apos; marcato come &quot;Abbonamento&quot;: impostalo nella sezione Servizi.
              </p>
            )}
          </label>

          <div>
            <span className={label}>Cliente</span>
            <SegmentedToggle
              value={clientMode}
              onChange={(v) => {
                setClientMode(v);
                setSelectedClient(null);
              }}
              options={[
                { value: "existing", label: "Cliente esistente" },
                { value: "new", label: "Nuovo cliente" },
              ]}
            />
          </div>

          {clientMode === "existing" && <ClientPicker selected={selectedClient} onSelect={setSelectedClient} />}

          <button type="button" onClick={goToStep2Or3} disabled={!appointmentTypeId} className={`w-full ${btnPrimary}`}>
            Avanti
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-4">
          <NewClientFields value={newClient} onChange={setNewClient} />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className={`flex-1 ${btnNeutral}`}>
              Indietro
            </button>
            <button type="button" onClick={goToStep3FromNewClient} className={`flex-1 ${btnPrimary}`}>
              Avanti
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-4">
          <div>
            <span className={label}>Giorni e orari ricorrenti</span>
            <div className="flex flex-wrap items-end gap-2">
              <select value={newDayOfWeek} onChange={(e) => setNewDayOfWeek(Number(e.target.value))} className={`${input} w-40`}>
                {WEEKDAY_LABELS_FULL.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" value={newDayTime} onChange={(e) => setNewDayTime(e.target.value)} className={`${input} w-28`} />
              <button type="button" onClick={addDayPattern} className={btnNeutral}>
                + Aggiungi giorno
              </button>
            </div>
            {dayPatterns.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dayPatterns.map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-1.5 border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    {WEEKDAY_LABELS_FULL[p.dayOfWeek]} {p.time}
                    <button type="button" onClick={() => removeDayPattern(p.id)} className="text-red-500 hover:text-red-600 dark:text-red-400">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <span className={label}>Data di inizio</span>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${input} w-full sm:w-40`} />
          </label>

          <div>
            <span className={label}>L&apos;abbonamento si considera chiuso...</span>
            <SegmentedToggle
              value={terminationMode}
              onChange={setTerminationMode}
              options={[
                { value: "count", label: "Dopo N sedute" },
                { value: "date", label: "Ad una data" },
              ]}
            />
            {terminationMode === "count" ? (
              <label className="mt-2 block">
                <span className={label}>Numero di sedute totali</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={sessionCount}
                  onChange={(e) => setSessionCount(Number(e.target.value))}
                  className={`${input} !w-24`}
                />
              </label>
            ) : (
              <label className="mt-2 block">
                <span className={label}>Scadenza</span>
                <input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${input} w-full sm:w-40`} />
              </label>
            )}
          </div>

          <label className="block">
            <span className={label}>Preavviso scadenza (giorni)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={notifyDaysBefore}
              onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
              className={`${input} !w-24`}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <Checkbox checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
              <span className="text-sm text-neutral-700 dark:text-neutral-200">Rinnovo automatico</span>
            </label>
            {autoRenew && (
              <label className="flex items-center gap-2">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">ogni</span>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Number(e.target.value))}
                  className={`${input} !w-16 shrink-0`}
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">mesi</span>
              </label>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(clientMode === "existing" ? 1 : 2)} className={`flex-1 ${btnNeutral}`}>
              Indietro
            </button>
            <button type="button" onClick={goToSummary} className={`flex-1 ${btnPrimary}`}>
              Genera sedute e vai al riepilogo
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="mt-4 space-y-4">
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Cliente</span>
              {clientMode === "existing" && selectedClient ? (
                <p className="text-sm text-neutral-900 dark:text-white">
                  {selectedClient.firstName} {selectedClient.lastName} &middot; {selectedClient.email}
                </p>
              ) : (
                <p className="text-sm text-neutral-900 dark:text-white">
                  {newClient.firstName} {newClient.lastName} &middot; {newClient.email}{" "}
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">(nuovo cliente)</span>
                </p>
              )}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Servizio</span>
              <p className="text-sm text-neutral-900 dark:text-white">
                {selectedService?.name}
                {selectedService && selectedService.unitPrice > 0 ? ` · ${formatCurrency(selectedService.unitPrice)}` : ""}
                {autoRenew ? ` · rinnovo automatico ogni ${renewMonths} mese/i` : ""}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Sedute ({sortedGeneratedSlots.length}) — modificabili
                {loadingAvailability && " · controllo disponibilita'..."}
              </span>
              <div className="mt-1 max-h-80 space-y-1.5 overflow-y-auto">
                {sortedGeneratedSlots.map((s) => {
                  const occ = occupancyFor(s);
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={s.startTime.slice(0, 10)}
                        onChange={(e) => editGeneratedSlot(s.id, "date", e.target.value)}
                        className={`${input} !w-36 shrink-0 text-sm`}
                      />
                      <input
                        type="time"
                        value={s.startTime.slice(11, 16)}
                        onChange={(e) => editGeneratedSlot(s.id, "time", e.target.value)}
                        className={`${input} !w-24 shrink-0 text-sm`}
                      />
                      {occ && (
                        <span className={`shrink-0 text-xs font-medium ${occ.full ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-500"}`}>
                          {occ.full ? "pieno" : `${occ.spotsLeft} liberi`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeGeneratedSlot(s.id)}
                        aria-label="Rimuovi"
                        className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Le sedute segnate come &quot;piene&quot; verranno comunque create in sovrannumero, senza modificare la capienza configurata. Alla
            conferma verra&apos; inviato un riepilogo via email al cliente e allo staff (se la posta SMTP e&apos; configurata).
          </p>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(3)} className={`flex-1 ${btnNeutral}`}>
              Indietro
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || sortedGeneratedSlots.length === 0}
              className={`flex-1 ${btnPrimary}`}
            >
              {submitting ? "Creazione in corso..." : "Conferma abbonamento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
