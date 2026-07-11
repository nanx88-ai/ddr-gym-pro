"use client";

import { useEffect, useState } from "react";
import {
  btnNeutral,
  btnPositive,
  btnPrimary,
  card,
  errorBox,
  input,
  label,
  pageSubtitle,
  pageTitle,
} from "@/lib/ui";
import ThemeToggle from "@/components/ThemeToggle";
import PushNotificationsToggle from "@/components/PushNotificationsToggle";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionsMenu, IconButton } from "@/components/IconAction";

/**
 * Sync calendario admin (Google/Apple) via feed ICS sottoscrivibile, senza
 * OAuth: Google Calendar ->"Aggiungi calendario"->"Da URL"; Apple Calendar
 * ->"Nuovo abbonamento calendario". L'app di calendario ricontrolla l'URL
 * periodicamente (di solito ogni poche ore), quindi non e'realtime.
 */
function CalendarSyncSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [urls, setUrls] = useState<{
    httpsUrl: string;
    webcalUrl: string;
  } | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/calendar-feed");
    setUrls(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function regenerate() {
    if (
      !(await confirm(
        "Rigenerare il link? Quello vecchio smettera'di funzionare e dovrai risottoscriverti.",
      ))
    )
      return;
    setRegenerating(true);
    await fetch("/api/admin/calendar-feed", { method: "POST" });
    await load();
    setRegenerating(false);
    toast.success("Link rigenerato.");
  }

  async function copy() {
    if (!urls) return;
    await navigator.clipboard.writeText(urls.httpsUrl);
    toast.success("Link copiato.");
  }

  return (
    <section className={`${card} mb-6 p-4`}>
      <h3 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
        Sincronizza calendario
      </h3>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        Sottoscrivi questo link in Google Calendar (&quot;Aggiungi
        calendario&quot; &rarr; &quot;Da URL&quot;) o Apple Calendar
        (&quot;Nuovo abbonamento calendario&quot;) per vedere gli appuntamenti
        confermati. L&apos;aggiornamento non e&apos; istantaneo: dipende da
        quanto spesso l&apos;app di calendario ricontrolla il link.
      </p>

      {urls && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={urls.httpsUrl}
              className={`${input} flex-1`}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" onClick={copy} className={btnNeutral}>
              Copia link
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <a
              href={urls.webcalUrl}
              className="text-yellow-600 hover:underline dark:text-yellow-400"
            >
              Apri in Apple Calendar (webcal)
            </a>
            <button
              type="button"
              onClick={regenerate}
              disabled={regenerating}
              className="text-red-500 hover:underline disabled:opacity-50"
            >
              Rigenera link (invalida quello vecchio)
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

interface Integration {
  id: string;
  name: string;
  type: string;
  config: string;
  active: boolean;
}

const TYPE_OPTIONS = [
  {
    value: "smtp",
    label: "Email (SMTP)",
    hint: "es. host, port, user, password, from",
  },
  {
    value: "google_oauth",
    label: "Google OAuth (login utenti)",
    hint: "es. client_id, client_secret, redirect_uri",
  },
  {
    value: "google_calendar",
    label: "Google Calendar",
    hint: "es. client_id, client_secret",
  },
  {
    value: "aruba",
    label: "Aruba Fatturazione Elettronica",
    hint: "es. api_key, username, password",
  },
  {
    value: "fattureincloud",
    label: "Fatture in Cloud",
    hint: "es. api_key, company_id",
  },
  { value: "custom", label: "Altro / personalizzata", hint: "chiavi libere" },
];

type KV = { key: string; value: string };

export default function AdminSettingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setPairs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const config = Object.fromEntries(
      pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
    );

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
    toast.success("Integrazione salvata.");
    load();
  }

  async function toggleActive(integration: Integration) {
    await fetch(`/api/admin/integrations/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !integration.active }),
    });
    toast.success(
      integration.active
        ? "Integrazione disattivata."
        : "Integrazione attivata.",
    );
    load();
  }

  async function remove(id: string, name: string) {
    if (!(await confirm(`Eliminare l'integrazione"${name}"?`))) return;
    await fetch(`/api/admin/integrations/${id}`, { method: "DELETE" });
    toast.success("Integrazione eliminata.");
    load();
  }

  const selectedType = TYPE_OPTIONS.find((t) => t.value === type);

  return (
    <div className="max-w-5xl">
      <h1 className={pageTitle}>Impostazioni</h1>
      <p className={pageSubtitle}>
        Aspetto, integrazioni API, esportazione dati e backup.
      </p>

      {error && <div className={errorBox}>{error}</div>}

      <h2 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Generali
      </h2>
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={`${card} p-4`}>
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Aspetto
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              Tema dell&apos;interfaccia admin
            </span>
            <ThemeToggle />
          </div>
        </section>

        <section className={`${card} p-4`}>
          <h3 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Notifiche push</h3>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Notifiche native su questo dispositivo (anche a PWA chiusa/in background). Vanno attivate separatamente
            su ogni telefono/computer da cui gestisci l&apos;admin.
          </p>
          <PushNotificationsToggle />
        </section>
      </div>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Dati e integrazioni
      </h2>

      <CalendarSyncSection />

      <section className={`${card} mb-6 p-4`}>
        <h3 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
          API e integrazioni
        </h3>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Chiavi salvate direttamente da qui invece che nei file di
          configurazione del server. Aruba, Fatture in Cloud, email (SMTP),
          Google OAuth e Google Calendar sono predisposti come stub finche&apos;
          non colleghi le chiavi reali: vedi la sezione Fatture per i provider
          di invio e la nota sulla sync calendario piu&apos; sotto.
        </p>

        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className={label}>Nome</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${input} w-48`}
              />
            </label>
            <label className="block">
              <span className={label}>Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`${input} w-full sm:w-64`}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedType && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Campi tipici: {selectedType.hint}
            </p>
          )}

          <div className="space-y-2">
            {pairs.map((p, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input
                  placeholder="chiave (es. host)"
                  value={p.key}
                  onChange={(e) => updatePair(i, { key: e.target.value })}
                  className={`${input} w-full sm:w-48 sm:flex-none`}
                />
                <input
                  placeholder="valore"
                  type="password"
                  value={p.value}
                  onChange={(e) => updatePair(i, { value: e.target.value })}
                  className={`${input} min-w-0 flex-1`}
                />
                <IconButton
                  onClick={() => setPairs((prev) => prev.filter((_, idx) => idx !== i))}
                  icon="remove"
                  label="Rimuovi campo"
                  tone="danger"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <IconButton
                onClick={() => setPairs((prev) => [...prev, { key: "", value: "" }])}
                icon="add"
                label="Aggiungi campo"
              />
            </div>
          </div>

          <button type="submit" disabled={creating} className={btnPositive}>
            {creating ? "Salvataggio..." : "Salva integrazione"}
          </button>
        </form>

        <div className="space-y-2">
          {integrations.map((integ) => (
            <div
              key={integ.id}
              className="flex items-center justify-between border border-neutral-200 p-3 text-sm dark:border-neutral-800"
            >
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {integ.name}
                </span>
                {""}
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  (
                  {TYPE_OPTIONS.find((t) => t.value === integ.type)?.label ??
                    integ.type}
                  )
                </span>
                <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {Object.keys(JSON.parse(integ.config)).join(",") ||
                    "nessun campo"}
                </div>
              </div>
              <ActionsMenu
                actions={[
                  {
                    key: "toggle",
                    icon: integ.active ? "pause" : "resume",
                    label: integ.active ? "Disattiva" : "Riattiva",
                    onClick: () => toggleActive(integ),
                  },
                  { key: "delete", icon: "delete", label: "Elimina", tone: "danger", onClick: () => remove(integ.id, integ.name) },
                ]}
              />
            </div>
          ))}
          {!loading && integrations.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Nessuna integrazione configurata.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={`${card} p-4`}>
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Esporta dati (CSV)
          </h3>
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
          <h3 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
            Backup
          </h3>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Scarica una copia completa del database (file .db). Conservala in un
            posto sicuro.
          </p>
          <a
            href="/api/admin/settings/backup"
            className={`inline-block ${btnPrimary}`}
          >
            Scarica backup
          </a>
        </section>
      </div>
    </div>
  );
}
