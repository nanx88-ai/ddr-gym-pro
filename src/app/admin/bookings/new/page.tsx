"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPositive, errorBox, input, label, pageSubtitle, pageTitle } from "@/lib/ui";
import { Checkbox } from "@/components/Checkbox";
import { expandWeeklyOccurrences, occurrenceCountEndDate, WEEKDAY_LABELS_FULL } from "@/lib/recurrence";

interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
}

export default function AdminNewBookingPage() {
  const router = useRouter();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [endMethod, setEndMethod] = useState<"count" | "date">("count");
  const [count, setCount] = useState(6);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/appointment-types")
      .then((res) => res.json())
      .then((json) => {
        setTypes(json.appointmentTypes ?? []);
        if (json.appointmentTypes?.[0]) setAppointmentTypeId(json.appointmentTypes[0].id);
      });
  }, []);

  const dayOfWeek = date ? new Date(`${date}T00:00:00`).getDay() : 0;
  const weekdayFull = WEEKDAY_LABELS_FULL[dayOfWeek];

  const occurrences = (() => {
    if (!recurring || !date) return [];
    const end = endMethod === "count" ? occurrenceCountEndDate(date, count) : endDate;
    if (!end) return [];
    return expandWeeklyOccurrences(dayOfWeek, date, end, time);
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const type = types.find((t) => t.id === appointmentTypeId);
    if (!type || !date) {
      setError("Compila tutti i campi obbligatori.");
      return;
    }

    const starts = recurring ? occurrences : [new Date(`${date}T${time}:00`)];
    if (starts.length === 0) {
      setError("Nessuna data valida da creare: controlla la ricorrenza.");
      return;
    }

    const items = starts.map((start) => ({
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + type.durationMinutes * 60000).toISOString(),
      isRecurring: recurring,
      recurrenceGroupId: recurring ? `${appointmentTypeId}-${date}-${time}` : undefined,
    }));

    setSubmitting(true);
    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientEmail,
        clientFirstName,
        clientLastName,
        appointmentTypeId,
        notes,
        items,
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

  return (
    <div className="mx-auto max-w-md">
      <h1 className={pageTitle}>Nuovo appuntamento</h1>
      <p className={pageSubtitle}>
        Nessun vincolo qui: puoi registrare un appuntamento gia&apos; avvenuto, in un orario gia&apos; occupato, o
        fuori dalle fasce configurate - decidi tu.
      </p>

      {error && <div className={errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={label}>Tipo di appuntamento (calendario)</span>
          <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={input}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Nome cliente</span>
            <input required value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Cognome cliente</span>
            <input required value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} className={input} />
          </label>
        </div>

        <label className="block">
          <span className={label}>Email cliente</span>
          <input required type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Data</span>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Ora</span>
            <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <Checkbox checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Ricorrente (stesso giorno della settimana e ora)
        </label>

        {recurring && (
          <div className="space-y-3 border-l-2 border-yellow-400/40 pl-3">
            <div className="flex border border-neutral-200 p-1 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setEndMethod("count")}
                className={`flex-1 border-2 py-1.5 text-xs font-medium transition-colors ${
                  endMethod === "count"
                    ? "border-yellow-500 text-yellow-600 hover:bg-yellow-400 hover:text-neutral-900 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-400 dark:hover:text-neutral-900"
                    : "border-transparent text-neutral-500 dark:text-neutral-400"
                }`}
              >
                Numero di volte
              </button>
              <button
                type="button"
                onClick={() => setEndMethod("date")}
                className={`flex-1 border-2 py-1.5 text-xs font-medium transition-colors ${
                  endMethod === "date"
                    ? "border-yellow-500 text-yellow-600 hover:bg-yellow-400 hover:text-neutral-900 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-400 dark:hover:text-neutral-900"
                    : "border-transparent text-neutral-500 dark:text-neutral-400"
                }`}
              >
                Data di fine
              </button>
            </div>
            {endMethod === "count" ? (
              <label className="block">
                <span className={label}>Quante volte</span>
                <div className="flex items-center gap-2">
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
                    className={`${input} w-20 shrink-0 text-center`}
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
                Tutti i {weekdayFull} alle {time}: {occurrences.length} appuntamenti in totale.
              </p>
            )}
          </div>
        )}

        <label className="block">
          <span className={label}>Note (facoltativo)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={input} rows={3} />
        </label>

        <button type="submit" disabled={submitting} className={`w-full ${btnPositive}`}>
          {submitting ? "Creazione in corso..." : "Crea appuntamento"}
        </button>
      </form>
    </div>
  );
}
