"use client";

import { useEffect, useState } from "react";
import {
  btnDanger,
  btnNeutral,
  btnPositive,
  btnPrimary,
  card,
  errorBox,
  input,
  label,
  pageSubtitle,
  pageTitle,
  successBox,
} from "@/lib/ui";
import ThemeToggle from "@/components/ThemeToggle";

interface Integration {
  id: string;
  name: string;
  type: string;
  config: string;
  active: boolean;
}

const TYPE_OPTIONS = [
  { value: "smtp", label: "Email (SMTP)", hint: "es. host, port, user, password, from" },
  { value: "google_oauth", label: "Google OAuth (login utenti)", hint: "es. client_id, client_secret, redirect_uri" },
  { value: "google_calendar", label: "Google Calendar", hint: "es. client_id, client_secret" },
  { value: "aruba", label: "Aruba Fatturazione Elettronica", hint: "es. api_key, username, password" },
  { value: "fattureincloud", label: "Fatture in Cloud", hint: "es. api_key, company_id" },
  { value: "custom", label: "Altro / personalizzata", hint: "chiavi libere" },
];

type KV = { key: string; value: string };

export default function AdminSettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("smtp");
  const [pairs, setPairs] = useState<KV[]>([{ key: "", value: "" }]);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/integrations");
    const json = await res.json();
    setIntegrations(json.integrations ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updatePair(index: number, patch: Partial<KV>) {
    setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setCreating(true);

    const config = Object.fromEntries(pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]));

    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, config }),
    });
    setCreating(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio.");
      return;
    }
    setName("");
    setPairs([{ key: "", value: "" }]);
    setMessage("Integrazione salvata.");
    load();
  }

  async function toggleActive(integration: Integration) {
    await fetch(`/api/admin/integrations/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !integration.active }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/integrations/${id}`, { method: "DELETE" });
    load();
  }

  const selectedType = TYPE_OPTIONS.find((t) => t.value === type);

  return (
    <div className="max-w-3xl">
      <h1 className={pageTitle}>Impostazioni</h1>
      <p className={pageSubtitle}>Aspetto, integrazioni API, esportazione dati e backup.</p>

      {error && <div className={errorBox}>{error}</div>}
      {message && <div className={successBox}>{message}</div>}

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Aspetto</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Tema dell&apos;interfaccia admin</span>
          <ThemeToggle />
        </div>
      </section>

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">API e integrazioni</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Chiavi salvate direttamente da qui invece che nei file di configurazione del server. Aruba, Fatture in
          Cloud, email (SMTP), Google OAuth e Google Calendar sono predisposti come stub finche&apos; non colleghi le
          chiavi reali: vedi la sezione Fatture per i provider di invio e la nota sulla sync calendario piu&apos; sotto.
        </p>

        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className={label}>Nome</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-48`} />
            </label>
            <label className="block">
              <span className={label}>Tipo</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={`${input} w-64`}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedType && <p className="text-xs text-neutral-500 dark:text-neutral-400">Campi tipici: {selectedType.hint}</p>}

          <div className="space-y-2">
            {pairs.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="chiave (es. host)"
                  value={p.key}
                  onChange={(e) => updatePair(i, { key: e.target.value })}
                  className={`${input} w-48`}
                />
                <input
                  placeholder="valore"
                  type="password"
                  value={p.value}
                  onChange={(e) => updatePair(i, { value: e.target.value })}
                  className={input}
                />
                <button
                  type="button"
                  onClick={() => setPairs((prev) => prev.filter((_, idx) => idx !== i))}
                  className={btnDanger}
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPairs((prev) => [...prev, { key: "", value: "" }])}
              className={btnNeutral}
            >
              + Aggiungi campo
            </button>
          </div>

          <button type="submit" disabled={creating} className={btnPositive}>
            {creating ? "Salvataggio..." : "Salva integrazione"}
          </button>
        </form>

        <div className="space-y-2">
          {integrations.map((integ) => (
            <div
              key={integ.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
            >
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">{integ.name}</span>{" "}
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  ({TYPE_OPTIONS.find((t) => t.value === integ.type)?.label ?? integ.type})
                </span>
                <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {Object.keys(JSON.parse(integ.config)).join(", ") || "nessun campo"}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(integ)} className={btnNeutral}>
                  {integ.active ? "Disattiva" : "Riattiva"}
                </button>
                <button onClick={() => remove(integ.id)} className={btnDanger}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
          {!loading && integrations.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna integrazione configurata.</p>
          )}
        </div>
      </section>

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Esporta dati (CSV)</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export/clients" className={btnNeutral}>
            Clienti
          </a>
          <a href="/api/admin/export/bookings" className={btnNeutral}>
            Prenotazioni
          </a>
          <a href="/api/admin/export/invoices" className={btnNeutral}>
            Fatture
          </a>
        </div>
      </section>

      <section className={`${card} p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Backup</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Scarica una copia completa del database (file .db). Conservala in un posto sicuro.
        </p>
        <a href="/api/admin/settings/backup" className={`inline-block ${btnPrimary}`}>
          Scarica backup
        </a>
      </section>
    </div>
  );
}
