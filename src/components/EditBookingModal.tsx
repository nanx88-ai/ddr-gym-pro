"use client";

import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, input } from "@/lib/ui";
import { useToast } from "@/components/Toast";

interface Slot {
  startTime: string;
  capacity: number;
  confirmed: number;
  pending: number;
  spotsLeft: number;
  full: boolean;
}

interface EditableBooking {
  id: string;
  startTime: string;
  endTime: string;
  appointmentTypeId: string;
  appointmentType: { name: string };
  client: { firstName: string; lastName: string };
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Modifica data/ora di una prenotazione esistente dal pannello admin.
 * Nessun vincolo bloccante (l'admin puo' spostare dove vuole, anche su uno
 * slot pieno o fuori fascia) - la disponibilita' dello slot scelto viene
 * comunque ricalcolata in tempo reale, solo come informazione a supporto
 * della decisione.
 */
export default function EditBookingModal({
  booking,
  onClose,
  onSaved,
}: {
  booking: EditableBooking;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const durationMs = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
  const [date, setDate] = useState(toDateInput(booking.startTime));
  const [time, setTime] = useState(toTimeInput(booking.startTime));
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    fetch(`/api/availability?date=${date}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const type = (json.appointmentTypes ?? []).find(
          (t: { appointmentTypeId: string }) => t.appointmentTypeId === booking.appointmentTypeId
        );
        setSlots(type?.slots ?? []);
      })
      .catch(() => !cancelled && setSlots(null))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [date, booking.appointmentTypeId]);

  const newStart = new Date(`${date}T${time}:00`);
  const matchingSlot = slots?.find((s) => new Date(s.startTime).getTime() === newStart.getTime()) ?? null;

  async function save() {
    setSaving(true);
    const newEnd = new Date(newStart.getTime() + durationMs);
    const res = await fetch(`/api/admin/bookings/${booking.id}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Errore durante lo spostamento.");
      return;
    }
    toast.success("Prenotazione spostata.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Modifica appuntamento</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          {booking.client.firstName} {booking.client.lastName} - {booking.appointmentType.name}
        </p>

        <label className="mb-2 block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Data</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} w-full`} />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Ora</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} w-full`} />
        </label>

        <div className="mb-4 border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-300">
          {loadingSlots ? (
            "Verifica disponibilita'..."
          ) : matchingSlot ? (
            <>
              {matchingSlot.full ? "Slot pieno" : `${matchingSlot.spotsLeft} posti liberi su ${matchingSlot.capacity}`} -
              puoi comunque salvare, come admin non hai vincoli.
            </>
          ) : (
            "Fuori dalla fascia oraria standard: va bene comunque, come admin non hai vincoli."
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Annulla
          </button>
          <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
