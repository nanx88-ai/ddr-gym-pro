"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btnNeutral, btnPrimary, card, errorBox, input, label, pageSubtitle, pageTitle } from "@/lib/ui";
import { Checkbox } from "@/components/Checkbox";
import { SegmentedToggle } from "@/components/SegmentedToggle";
import { ClientPicker, type ClientOption } from "@/components/ClientPicker";
import { NewClientFields, emptyNewClient, newClientIsValid, type NewClientState } from "@/components/NewClientFields";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { expandWeeklyOccurrences, occurrenceCountEndDate, WEEKDAY_LABELS_FULL } from "@/lib/recurrence";

interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  unitPrice: number;
  active: boolean;
  bookingKind: "ONE_TIME" | "SUBSCRIPTION";
}

interface Slot {
  startTime: string;
  endTime: string;
  capacity: number;
  confirmed: number;
  pending: number;
  spotsLeft: number;
  full: boolean;
  isPast: boolean;
}

interface CartSlot {
  id: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceGroupId?: string;
}

type ClientMode = "existing" | "new";

let idCounter = 0;
function nextId() {
  return `slot-${idCounter++}`;
}

export default function AdminNewBookingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);

  // Step 2 (solo cliente nuovo)
  const [newClient, setNewClient] = useState<NewClientState>(emptyNewClient());

  // Step 3: aggiunta slot
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [closedNote, setClosedNote] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [endMethod, setEndMethod] = useState<"count" | "date">("count");
  const [count, setCount] = useState(6);
  const [endDate, setEndDate] = useState("");
  const [cart, setCart] = useState<CartSlot[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/appointment-types?all=1")
      .then((res) => res.json())
      .then((json) => {
        const active: AppointmentType[] = (json.appointmentTypes ?? []).filter((t: AppointmentType) => t.active);
        setTypes(active);
        if (active[0]) setAppointmentTypeId(active[0].id);
      });
  }, []);

  const selectedType = types.find((t) => t.id === appointmentTypeId) ?? null;
  const isSubscriptionService = selectedType?.bookingKind === "SUBSCRIPTION";

  useEffect(() => {
    if (step !== 3 || !date || !appointmentTypeId) return;
    setLoadingSlots(true);
    setTime("");
    fetch(`/api/admin/availability?date=${date}&appointmentTypeId=${appointmentTypeId}`)
      .then((res) => res.json())
      .then((json) => {
        setSlots(json.slots ?? []);
        setClosedNote(json.closedNote ?? null);
      })
      .finally(() => setLoadingSlots(false));
  }, [step, date, appointmentTypeId]);

  const dayOfWeek = date ? new Date(`${date}T00:00:00`).getDay() : 0;
  const weekdayFull = WEEKDAY_LABELS_FULL[dayOfWeek];

  const occurrences = (() => {
    if (!recurring || !date || !time) return [];
    const end = endMethod === "count" ? occurrenceCountEndDate(date, count) : endDate;
    if (!end) return [];
    return expandWeeklyOccurrences(dayOfWeek, date, end, time);
  })();

  const selectedSlot = slots?.find((s) => s.startTime.slice(11, 16) === time) ?? null;

  const sortedCart = useMemo(() => [...cart].sort((a, b) => a.startTime.localeCompare(b.startTime)), [cart]);

  function goToStep2Or3() {
    setError(null);
    if (!appointmentTypeId) {
      setError("Scegli un servizio.");
      return;
    }
    if (isSubscriptionService) return; // il pulsante "Vai a Abbonamenti" sostituisce "Avanti" in questo caso
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

  /** Aggiunge la data/orario (o l'intera serie ricorrente) correntemente configurati come slot individuali, poi resetta i campi per l'aggiunta successiva. */
  function addSlot() {
    setError(null);
    if (!selectedType || !date || !time) {
      setError("Scegli data e orario prima di aggiungere.");
      return;
    }

    const starts = recurring ? occurrences : [new Date(`${date}T${time}:00`)];
    if (starts.length === 0) {
      setError("Nessuna data valida da aggiungere: controlla la ricorrenza.");
      return;
    }

    const recurrenceGroupId = recurring ? `${appointmentTypeId}-${date}-${time}-${nextId()}` : undefined;
    const newSlots: CartSlot[] = starts.map((start) => ({
      id: nextId(),
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + selectedType.durationMinutes * 60000).toISOString(),
      isRecurring: recurring,
      recurrenceGroupId,
    }));

    setCart((prev) => [...prev, ...newSlots]);

    // Reset per la prossima aggiunta, cosi' l'admin puo' scegliere subito un altro giorno/orario.
    setDate("");
    setTime("");
    setSlots(null);
    setRecurring(false);
    setEndDate("");
    setCount(6);
  }

  function removeSlot(id: string) {
    setCart((prev) => prev.filter((s) => s.id !== id));
  }

  /** Modifica diretta di data o orario di uno slot gia' aggiunto (usata anche nel riepilogo finale). */
  function editSlot(id: string, field: "date" | "time", value: string) {
    setCart((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const start = new Date(s.startTime);
        const durationMs = new Date(s.endTime).getTime() - start.getTime();
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

  function goToSummary() {
    setError(null);
    if (cart.length === 0) {
      setError("Aggiungi almeno uno slot prima di procedere.");
      return;
    }
    setStep(4);
  }

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);

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

    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...clientPayload,
        appointmentTypeId,
        notes,
        items: sortedCart.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          isRecurring: s.isRecurring,
          recurrenceGroupId: s.recurrenceGroupId,
        })),
      }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? "Errore durante la creazione.");
      return;
    }

    router.push("/admin");
  }

  const stepLabel =
    step === 1 ? "servizio e cliente" : step === 2 ? "dati del nuovo cliente" : step === 3 ? "date e orari" : "riepilogo e conferma";

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Nuova prenotazione</h1>
          <p className={pageSubtitle}>
            Passo {step} di 4 &middot; {stepLabel}
          </p>
        </div>
        <button type="button" onClick={() => router.push("/admin")} className={`${btnPrimary} shrink-0 whitespace-nowrap`}>
          &larr; Indietro
        </button>
      </div>

      {error && <div className={`mt-4 ${errorBox}`}>{error}</div>}

      {step === 1 && (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className={label}>Servizio</span>
            <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={input}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.durationMinutes} min{t.unitPrice > 0 ? ` · ${formatCurrency(t.unitPrice)}` : ""})
                  {t.bookingKind === "SUBSCRIPTION" ? " — abbonamento" : ""}
                </option>
              ))}
            </select>
          </label>

          {isSubscriptionService ? (
            <div className={`${card} space-y-3 p-4`}>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                <strong>{selectedType?.name}</strong> e&apos; un servizio venduto ad abbonamento: non si prenota data per data da qui.
                Usa la sezione Abbonamenti per registrare il cliente sulla ricorrenza scelta.
              </p>
              <Link href="/admin/subscriptions" className={`inline-block ${btnPrimary}`}>
                Vai a Abbonamenti
              </Link>
            </div>
          ) : (
            <>
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

              <button type="button" onClick={goToStep2Or3} className={`w-full ${btnPrimary}`}>
                Avanti
              </button>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
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
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className={label}>Data</span>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>

          {date && (
            <div>
              <span className={label}>Orario</span>
              {loadingSlots && <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento disponibilita&apos;...</p>}
              {!loadingSlots && closedNote && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{closedNote} (puoi comunque scegliere un orario manualmente qui sotto).</p>
              )}
              {!loadingSlots && slots && slots.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {slots.map((s) => {
                    const hhmm = s.startTime.slice(11, 16);
                    const isSelected = time === hhmm;
                    return (
                      <button
                        key={s.startTime}
                        type="button"
                        onClick={() => setTime(hhmm)}
                        className={`flex flex-col items-center border-2 px-1 py-2 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-yellow-500 bg-yellow-400 text-neutral-900 dark:border-yellow-400"
                            : s.full
                              ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                              : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {hhmm}
                        <span className="text-[10px] opacity-80">{s.full ? "pieno" : `${s.spotsLeft} liberi`}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="mt-2 block">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Oppure inserisci un orario manuale (fuori fascia, giorno chiuso, ecc.):
                </span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} mt-1 w-32`} />
              </label>
              {selectedSlot?.full && (
                <p className="mt-2 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                  Questo slot risulta gia&apos; pieno ({selectedSlot.confirmed + selectedSlot.pending}/{selectedSlot.capacity}). Puoi
                  comunque procedere: la prenotazione verra&apos; creata in sovrannumero, senza modificare la capienza configurata.
                </p>
              )}
            </div>
          )}

          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <Checkbox checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Ricorrente (stesso giorno della settimana e ora)
          </label>

          {recurring && (
            <div className="space-y-3 border-l-2 border-yellow-400/40 pl-3">
              <SegmentedToggle
                value={endMethod}
                onChange={setEndMethod}
                options={[
                  { value: "count", label: "Numero di volte" },
                  { value: "date", label: "Data di fine" },
                ]}
              />
              {endMethod === "count" ? (
                <label className="block">
                  <span className={label}>Quante volte</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCount((c) => Math.max(2, c - 1))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-300 bg-neutral-100 text-lg font-semibold text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      &minus;
                    </button>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={count}
                      onChange={(e) => setCount(e.target.value === "" ? ("" as unknown as number) : Number(e.target.value))}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        setCount(Number.isFinite(v) && v >= 2 ? Math.min(52, v) : 2);
                      }}
                      className={`${input} !w-16 shrink-0 px-1 text-center`}
                    />
                    <button
                      type="button"
                      onClick={() => setCount((c) => Math.min(52, c + 1))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-300 bg-neutral-100 text-lg font-semibold text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      +
                    </button>
                  </div>
                </label>
              ) : (
                <label className="block">
                  <span className={label}>Fino al</span>
                  <input type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
                </label>
              )}
              {occurrences.length > 0 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Tutti i {weekdayFull} alle {time}: {occurrences.length} appuntamenti in totale. Ogni occorrenza viene creata a se&apos;:
                  se una risultasse piena verra&apos; comunque prenotata in sovrannumero, senza alterare la capienza delle altre.
                </p>
              )}
            </div>
          )}

          <button type="button" onClick={addSlot} className={`w-full ${btnNeutral}`}>
            + Aggiungi slot
          </button>

          {sortedCart.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <span className={label}>Slot aggiunti ({sortedCart.length})</span>
              {sortedCart.map((s) => (
                <div key={s.id} className={`${card} flex items-center justify-between gap-2 p-2.5`}>
                  <span className="text-sm text-neutral-800 dark:text-neutral-100">{formatDateTime(s.startTime)}</span>
                  <button
                    type="button"
                    onClick={() => removeSlot(s.id)}
                    aria-label="Rimuovi"
                    className="flex h-8 w-8 shrink-0 items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="block">
            <span className={label}>Note (facoltativo, valgono per tutta la prenotazione)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={input} rows={3} />
          </label>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(clientMode === "existing" ? 1 : 2)} className={`flex-1 ${btnNeutral}`}>
              Indietro
            </button>
            <button type="button" onClick={goToSummary} disabled={cart.length === 0} className={`flex-1 ${btnPrimary}`}>
              Vai al riepilogo
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="mt-6 space-y-4">
          <div className={`${card} space-y-3 p-4`}>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Cliente</span>
              {clientMode === "existing" && selectedClient ? (
                <p className="text-sm text-neutral-900 dark:text-white">
                  {selectedClient.firstName} {selectedClient.lastName} &middot; {selectedClient.email}
                  {selectedClient.phone ? ` · ${selectedClient.phone}` : ""}
                </p>
              ) : (
                <p className="text-sm text-neutral-900 dark:text-white">
                  {newClient.firstName} {newClient.lastName} &middot; {newClient.email}
                  {newClient.phone ? ` · ${newClient.phone}` : ""} <span className="text-xs text-neutral-500 dark:text-neutral-400">(nuovo cliente)</span>
                </p>
              )}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Servizio</span>
              <p className="text-sm text-neutral-900 dark:text-white">
                {selectedType?.name}
                {selectedType && selectedType.unitPrice > 0 ? ` · ${formatCurrency(selectedType.unitPrice)}` : ""}
              </p>
            </div>
            {notes && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Note</span>
                <p className="text-sm text-neutral-900 dark:text-white">{notes}</p>
              </div>
            )}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Date e orari ({sortedCart.length}) — modificabili
              </span>
              <div className="mt-1 max-h-80 space-y-1.5 overflow-y-auto">
                {sortedCart.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={s.startTime.slice(0, 10)}
                      onChange={(e) => editSlot(s.id, "date", e.target.value)}
                      className={`${input} !w-36 shrink-0 text-sm`}
                    />
                    <input
                      type="time"
                      value={s.startTime.slice(11, 16)}
                      onChange={(e) => editSlot(s.id, "time", e.target.value)}
                      className={`${input} !w-24 shrink-0 text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(s.id)}
                      aria-label="Rimuovi"
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Alla conferma verra&apos; inviato un riepilogo via email al cliente e allo staff (se la posta SMTP e&apos; configurata in
            Impostazioni).
          </p>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(3)} className={`flex-1 ${btnNeutral}`}>
              Indietro
            </button>
            <button type="button" onClick={handleConfirm} disabled={submitting || cart.length === 0} className={`flex-1 ${btnPrimary}`}>
              {submitting ? "Creazione in corso..." : "Conferma prenotazione"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
