"use client";

import { useEffect, useMemo, useState } from "react";
import { card, input } from "@/lib/ui";

export interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

/**
 * Tendina filtrabile per scegliere un cliente esistente (digitando nome o
 * cognome si vede subito l'altro campo per disambiguare gli omonimi), usata
 * sia dal wizard "Nuova prenotazione" che da "Nuovo abbonamento". Carica
 * l'elenco clienti una sola volta al mount.
 */
export function ClientPicker({
  selected,
  onSelect,
}: {
  selected: ClientOption | null;
  onSelect: (client: ClientOption | null) => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((res) => res.json())
      .then((json) => setClients(json.clients ?? []));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 20);
    return clients.filter((c) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q)).slice(0, 20);
  }, [clients, query]);

  if (selected) {
    return (
      <div className={`${card} flex items-center justify-between p-3`}>
        <div>
          <div className="font-medium text-neutral-900 dark:text-white">
            {selected.firstName} {selected.lastName}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {selected.email}
            {selected.phone ? ` · ${selected.phone}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Cambia
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca per nome o cognome..."
        className={`${input} mb-2 w-full`}
      />
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className="flex w-full items-center justify-between border border-neutral-200 p-2.5 text-left text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
          >
            <span className="font-medium text-neutral-900 dark:text-white">
              {c.firstName} {c.lastName}
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{c.email}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun cliente trovato.</p>}
      </div>
    </>
  );
}
