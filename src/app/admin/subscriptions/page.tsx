"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  btnPositive,
  card,
  input,
  label,
  pageSubtitle,
  pageTitle,
  tableWrap,
  td,
  th,
  trBorder,
} from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionsMenu } from "@/components/IconAction";
import { StatusDot } from "@/components/StatusDot";
import { Checkbox } from "@/components/Checkbox";
import { SortableTh, type SortDir } from "@/components/SortableTh";

interface Subscription {
  id: string;
  clientId: string;
  tariffId: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewMonths: number;
  notifyDaysBefore: number;
  client: { id: string; firstName: string; lastName: string; email: string };
  tariff: { id: string; title: string; price: number };
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface TariffOption {
  id: string;
  title: string;
  price: number;
  active: boolean;
}

/** Stato derivato dalla scadenza: attivo / in scadenza (entro 7 giorni) / scaduto. */
function subStatus(sub: Subscription): { key: "ACTIVE" | "EXPIRING" | "EXPIRED"; label: string } {
  const end = new Date(sub.endDate).getTime();
  const now = Date.now();
  if (end < now) return { key: "EXPIRED", label: "Scaduto" };
  if (end - now < 7 * 86400000) return { key: "EXPIRING", label: "In scadenza" };
  return { key: "ACTIVE", label: "Attivo" };
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "ACTIVE",
  EXPIRING: "PENDING_APPROVAL", // ambra: in attesa/in scadenza
  EXPIRED: "REJECTED", // rosso
};

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

export default function AdminSubscriptionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [tariffs, setTariffs] = useState<TariffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [tariffId, setTariffId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(7);
  const [creating, setCreating] = useState(false);

  const [sortBy, setSortBy] = useState<"client" | "tariff" | "end">("end");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: "client" | "tariff" | "end") {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortedItems = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortBy === "client")
        return dir * `${a.client.lastName} ${a.client.firstName}`.localeCompare(`${b.client.lastName} ${b.client.firstName}`);
      if (sortBy === "tariff") return dir * a.tariff.title.localeCompare(b.tariff.title);
      return dir * (new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    });
  }, [items, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    const [subsRes, clientsRes, tariffsRes] = await Promise.all([
      fetch("/api/admin/subscriptions"),
      fetch("/api/admin/clients"),
      fetch("/api/admin/tariffs"),
    ]);
    const subs = await subsRes.json();
    const cls = await clientsRes.json();
    const trf = await tariffsRes.json();
    setItems(subs.items ?? []);
    setClients(cls.clients ?? cls.items ?? []);
    setTariffs(trf.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, tariffId, startDate, endDate, autoRenew, renewMonths, notifyDaysBefore }),
    });
    setCreating(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante la creazione.");
      return;
    }
    setClientId("");
    setTariffId("");
    setEndDate("");
    setAutoRenew(false);
    toast.success("Abbonamento creato.");
    load();
  }

  async function updateField(sub: Subscription, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error("Aggiornamento non riuscito.");
      return;
    }
    toast.success("Abbonamento aggiornato.");
    load();
  }

  async function remove(sub: Subscription) {
    if (
      !(await confirm(
        `Eliminare l'abbonamento di ${sub.client.firstName} ${sub.client.lastName} (${sub.tariff.title})?`,
      ))
    )
      return;
    await fetch(`/api/admin/subscriptions/${sub.id}`, { method: "DELETE" });
    toast.success("Abbonamento eliminato.");
    load();
  }

  function subActions(sub: Subscription) {
    return [
      { key: "delete", icon: "delete" as const, label: "Elimina", tone: "danger" as const, onClick: () => remove(sub) },
    ];
  }

  /** Campi comuni di modifica inline (scadenza, rinnovo, preavviso) usati sia dalle card mobile che dalla tabella. */
  function editFields(sub: Subscription, compact: boolean) {
    return (
      <>
        <label className={compact ? "block" : "inline-block"}>
          {compact && <span className={label}>Scadenza</span>}
          <input
            type="date"
            defaultValue={toDateInput(sub.endDate)}
            onBlur={(e) => {
              const v = e.target.value;
              if (v && v !== toDateInput(sub.endDate)) updateField(sub, { endDate: v });
            }}
            className={`${input} ${compact ? "" : "w-38 shrink-0"}`}
          />
        </label>
        <label className={`flex items-center gap-2 ${compact ? "mt-1" : ""}`}>
          <Checkbox
            checked={sub.autoRenew}
            onChange={(e) => updateField(sub, { autoRenew: e.target.checked })}
          />
          <span className="text-sm text-neutral-700 dark:text-neutral-200">Rinnovo automatico</span>
        </label>
        {sub.autoRenew && (
          <label className={`flex items-center gap-2 ${compact ? "mt-1" : ""}`}>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">ogni</span>
            <input
              type="number"
              min={1}
              max={36}
              defaultValue={sub.renewMonths}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v !== sub.renewMonths) updateField(sub, { renewMonths: v });
              }}
              className={`${input} w-16 shrink-0`}
            />
            <span className="text-sm text-neutral-500 dark:text-neutral-400">mesi</span>
          </label>
        )}
      </>
    );
  }

  return (
    <div>
      <h1 className={pageTitle}>Abbonamenti</h1>
      <p className={pageSubtitle}>
        Abbonamenti sottoscritti dai clienti sulle voci del tariffario. Il
        promemoria di scadenza/rinnovo parte in automatico via email (a te e
        al cliente) e notifica push nei giorni di preavviso impostati; se il
        rinnovo automatico e&apos; attivo, alla scadenza l&apos;abbonamento si
        estende da solo della durata indicata.
      </p>

      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Nuovo abbonamento</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label className="block sm:w-56">
            <span className={label}>Cliente</span>
            <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}>
              <option value="">Seleziona...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lastName} {c.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:w-64">
            <span className={label}>Tariffa</span>
            <select required value={tariffId} onChange={(e) => setTariffId(e.target.value)} className={input}>
              <option value="">Seleziona...</option>
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({formatCurrency(t.price)}){t.active ? "" : " - in pausa"}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:w-40">
            <span className={label}>Inizio</span>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
          </label>
          <label className="block sm:w-40">
            <span className={label}>Scadenza</span>
            <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
          </label>
          <label className="block sm:w-36">
            <span className={label}>Preavviso (giorni)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={notifyDaysBefore}
              onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
              className={input}
            />
          </label>
          <div className="flex min-h-11 flex-wrap items-center gap-2">
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
                  className={`${input} w-16 shrink-0`}
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">mesi</span>
              </label>
            )}
          </div>
          <button type="submit" disabled={creating} className={`${btnPositive} w-full sm:w-auto`}>
            {creating ? "Creazione..." : "Aggiungi"}
          </button>
        </form>
      </div>

      {!loading && items.length === 0 && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          Nessun abbonamento. Crea il primo qui sopra.
        </p>
      )}

      {/* Mobile: schede */}
      {items.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sortedItems.map((sub) => {
            const st = subStatus(sub);
            return (
              <div key={sub.id} className={`${card} p-4`}>
                <div className="flex items-center gap-2">
                  <StatusDot status={STATUS_DOT[st.key]} label={st.label} />
                  <span className="flex-1 truncate font-medium text-neutral-900 dark:text-white">
                    {sub.client.firstName} {sub.client.lastName}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {sub.tariff.title} &middot; {formatCurrency(sub.tariff.price)} &middot; dal {formatDate(sub.startDate)}
                </p>
                <div className="mt-2 space-y-2">{editFields(sub, true)}</div>
                <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <ActionsMenu actions={subActions(sub)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {items.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <SortableTh label="Cliente" sortKey="client" active={sortBy === "client"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Tariffa" sortKey="tariff" active={sortBy === "tariff"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Inizio</th>
                <SortableTh label="Scadenza" sortKey="end" active={sortBy === "end"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Rinnovo</th>
                <th className={`${th} whitespace-nowrap`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((sub) => {
                const st = subStatus(sub);
                return (
                  <tr key={sub.id} className={trBorder}>
                    <td className={td}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <StatusDot status={STATUS_DOT[st.key]} label={st.label} />
                        <span className="font-medium">
                          {sub.client.lastName} {sub.client.firstName}
                        </span>
                      </div>
                    </td>
                    <td className={td}>
                      <select
                        value={sub.tariffId}
                        onChange={(e) => updateField(sub, { tariffId: e.target.value })}
                        className={`${input} w-full min-w-44`}
                      >
                        {tariffs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({formatCurrency(t.price)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(sub.startDate)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <input
                        type="date"
                        defaultValue={toDateInput(sub.endDate)}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v && v !== toDateInput(sub.endDate)) updateField(sub, { endDate: v });
                        }}
                        className={`${input} w-38 shrink-0`}
                      />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={sub.autoRenew}
                          onChange={(e) => updateField(sub, { autoRenew: e.target.checked })}
                          title={sub.autoRenew ? "Rinnovo automatico attivo" : "Nessun rinnovo automatico"}
                        />
                        {sub.autoRenew && (
                          <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                            ogni
                            <input
                              type="number"
                              min={1}
                              max={36}
                              defaultValue={sub.renewMonths}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v >= 1 && v !== sub.renewMonths) updateField(sub, { renewMonths: v });
                              }}
                              className={`${input} w-14 shrink-0`}
                            />
                            mesi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="flex justify-end">
                        <ActionsMenu actions={subActions(sub)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
