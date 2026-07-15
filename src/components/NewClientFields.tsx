"use client";

import { input, label } from "@/lib/ui";

export interface NewClientState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  sex: string;
}

export function emptyNewClient(): NewClientState {
  return { firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", sex: "" };
}

export function newClientIsValid(c: NewClientState): boolean {
  return !!(c.firstName.trim() && c.lastName.trim() && c.email.trim());
}

/**
 * Campi minimi per registrare un cliente ex novo dentro un wizard (nuova
 * prenotazione, nuovo abbonamento): nome/cognome/email obbligatori,
 * telefono/data di nascita/sesso facoltativi. Il resto dei dati anagrafici
 * (indirizzo, dati fiscali, ecc.) si completa in seguito dalla scheda
 * cliente, una volta che il record esiste.
 */
export function NewClientFields({ value, onChange }: { value: NewClientState; onChange: (next: NewClientState) => void }) {
  function patch(key: keyof NewClientState, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Nome</span>
          <input required value={value.firstName} onChange={(e) => patch("firstName", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Cognome</span>
          <input required value={value.lastName} onChange={(e) => patch("lastName", e.target.value)} className={input} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Email</span>
        <input required type="email" value={value.email} onChange={(e) => patch("email", e.target.value)} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Telefono (facoltativo)</span>
          <input value={value.phone} onChange={(e) => patch("phone", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Data di nascita (facoltativa)</span>
          <input type="date" value={value.dateOfBirth} onChange={(e) => patch("dateOfBirth", e.target.value)} className={input} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Sesso (facoltativo)</span>
        <select value={value.sex} onChange={(e) => patch("sex", e.target.value)} className={input}>
          <option value="">Non specificato</option>
          <option value="M">Maschio</option>
          <option value="F">Femmina</option>
          <option value="OTHER">Altro</option>
        </select>
      </label>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Il resto dei dati anagrafici (indirizzo, dati fiscali, ecc.) si completa in seguito dalla scheda cliente.
      </p>
    </div>
  );
}
