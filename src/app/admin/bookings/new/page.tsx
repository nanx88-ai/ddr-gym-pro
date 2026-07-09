"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPositive, input, label, pageTitle } from "@/lib/ui";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const type = types.find((t) => t.id === appointmentTypeId);
    if (!type || !date) {
      setError("Compila tutti i campi obbligatori.");
      return;
    }

    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + type.durationMinutes * 60000);

    setSubmitting(true);
    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientEmail,
        clientFirstName,
        clientLastName,
        appointmentTypeId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes,
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
    <div className="max-w-md">
      <h1 className={pageTitle}>Nuovo appuntamento</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

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
            <input
              required
              value={clientFirstName}
              onChange={(e) => setClientFirstName(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Cognome cliente</span>
            <input
              required
              value={clientLastName}
              onChange={(e) => setClientLastName(e.target.value)}
              className={input}
            />
          </label>
        </div>

        <label className="block">
          <span className={label}>Email cliente</span>
          <input
            required
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className={input}
          />
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
