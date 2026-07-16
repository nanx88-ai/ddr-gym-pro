"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  btnNeutral,
  btnPrimary,
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
import { SortDirToggle } from "@/components/SortDirToggle";
import { SubscriptionCreatorWizard } from "@/components/SubscriptionCreatorWizard";
import { SkeletonCards } from "@/components/Skeleton";

interface Subscription {
  id: string;
  clientId: string;
  appointmentTypeId: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewMonths: number;
  notifyDaysBefore: number;
  client: { id: string; firstName: string; lastName: string; email: string };
  appointmentType: { id: string; name: string; unitPrice: number };
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  unitPrice: number;
  active: boolean;
  bookingKind: "ONE_TIME" | "SUBSCRIPTION";
}

interface FormState {
  clientId: string;
  appointmentTypeId: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewMonths: number;
  notifyDaysBefore: number;
}

function emptyForm(): FormState {
  return {
    clientId: "",
    appointmentTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    autoRenew: false,
    renewMonths: 1,
    notifyDaysBefore: 7,
  };
}

function toForm(sub: Subscription): FormState {
  return {
    clientId: sub.clientId,
    appointmentTypeId: sub.appointmentTypeId,
    startDate: toDateInput(sub.startDate),
    endDate: toDateInput(sub.endDate),
    autoRenew: sub.autoRenew,
    renewMonths: sub.renewMonths,
    notifyDaysBefore: sub.notifyDaysBefore,
  };
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
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(""); // "" | "ACTIVE" | "EXPIRING" | "EXPIRED"
  const [serviceFilter, setServiceFilter] = useState("");

  // null = pannello chiuso; "new" = creazione; altrimenti id dell'abbonamento in modifica.
  const [editingId, setEditingId] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [sortBy, setSortBy] = useState<"client" | "service" | "end">("end");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortActive, setSortActive] = useState(false);

  function handleSort(key: "client" | "service" | "end") {
    setSortActive(true);
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const activeFilterCount = [statusFilter, serviceFilter].filter(Boolean).length;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (q && !`${s.client.firstName} ${s.client.lastName} ${s.client.email}`.toLowerCase().includes(q)) return false;
      if (statusFilter && subStatus(s).key !== statusFilter) return false;
      if (serviceFilter && s.appointmentTypeId !== serviceFilter) return false;
      return true;
    });
  }, [items, search, statusFilter, serviceFilter]);

  const sortedItems = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      if (sortBy === "client")
        return dir * `${a.client.lastName} ${a.client.firstName}`.localeCompare(`${b.client.lastName} ${b.client.firstName}`);
      if (sortBy === "service") return dir * a.appointmentType.name.localeCompare(b.appointmentType.name);
      return dir * (new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    });
  }, [filteredItems, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    const [subsRes, clientsRes, servicesRes] = await Promise.all([
      fetch("/api/admin/subscriptions"),
      fetch("/api/admin/clients"),
      fetch("/api/admin/appointment-types?all=1"),
    ]);
    const subs = await subsRes.json();
    const cls = await clientsRes.json();
    const svc = await servicesRes.json();
    setItems(subs.items ?? []);
    setClients(cls.clients ?? cls.items ?? []);
    setServices(svc.appointmentTypes ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setEditingId("new");
  }

  function openEdit(sub: Subscription) {
    setForm(toForm(sub));
    setEditingId(sub.id);
  }

  function closeEditor() {
    setEditingId(null);
  }

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Modifica un abbonamento esistente (la creazione passa dal wizard SubscriptionCreatorWizard). */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      appointmentTypeId: form.appointmentTypeId,
      startDate: form.startDate,
      endDate: form.endDate,
      autoRenew: form.autoRenew,
      renewMonths: form.renewMonths,
      notifyDaysBefore: form.notifyDaysBefore,
    };

    const res = await fetch(`/api/admin/subscriptions/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio.");
      return;
    }
    toast.success("Abbonamento aggiornato.");
    closeEditor();
    load();
  }

  async function remove(sub: Subscription) {
    if (
      !(await confirm(
        `Eliminare l'abbonamento di ${sub.client.firstName} ${sub.client.lastName} (${sub.appointmentType.name})?`,
      ))
    )
      return;
    await fetch(`/api/admin/subscriptions/${sub.id}`, { method: "DELETE" });
    toast.success("Abbonamento eliminato.");
    if (editingId === sub.id) closeEditor();
    load();
  }

  function subActions(sub: Subscription) {
    return [
      { key: "edit", icon: "edit" as const, label: "Modifica", onClick: () => openEdit(sub) },
      { key: "delete", icon: "delete" as const, label: "Elimina", tone: "danger" as const, onClick: () => remove(sub) },
    ];
  }

  const editorOpen = editingId !== null;
  const subscriptionServices = services.filter((s) => s.bookingKind === "SUBSCRIPTION");

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Abbonamenti</h1>
          <p className={pageSubtitle}>
            Abbonamenti sottoscritti dai clienti sui servizi. Il promemoria di
            scadenza/rinnovo parte in automatico via email e push; se il
            rinnovo automatico e&apos; attivo, alla scadenza si estende da solo.
          </p>
        </div>
        {!editorOpen && (
          <button type="button" onClick={openCreate} className={`${btnPrimary} shrink-0 whitespace-nowrap`}>
            + Nuovo abbonamento
          </button>
        )}
      </div>

      {editingId === "new" && (
        <SubscriptionCreatorWizard
          services={subscriptionServices}
          onClose={closeEditor}
          onCreated={() => {
            toast.success("Abbonamento creato.");
            closeEditor();
            load();
          }}
        />
      )}

      {editorOpen && editingId !== "new" && (
        <form onSubmit={handleSubmit} className={`${card} mt-6 mb-6 p-4`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Modifica abbonamento</h2>
            <button type="button" onClick={closeEditor} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
              Chiudi
            </button>
          </div>

          {error && (
            <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <label className="block sm:w-56">
              <span className={label}>Cliente</span>
              <select
                required
                disabled
                value={form.clientId}
                onChange={(e) => patchForm("clientId", e.target.value)}
                className={`${input} disabled:opacity-60`}
              >
                <option value="">Seleziona...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName} {c.firstName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:w-64">
              <span className={label}>Servizio</span>
              <select
                required
                value={form.appointmentTypeId}
                onChange={(e) => patchForm("appointmentTypeId", e.target.value)}
                className={input}
              >
                <option value="">Seleziona...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatCurrency(s.unitPrice)}){s.active ? "" : " - disattivato"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:w-40">
              <span className={label}>Inizio</span>
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => patchForm("startDate", e.target.value)}
                className={input}
              />
            </label>
            <label className="block sm:w-40">
              <span className={label}>Scadenza</span>
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => patchForm("endDate", e.target.value)}
                className={input}
              />
            </label>
            <label className="block sm:w-36">
              <span className={label}>Preavviso (giorni)</span>
              <input
                type="number"
                min={0}
                max={90}
                value={form.notifyDaysBefore}
                onChange={(e) => patchForm("notifyDaysBefore", Number(e.target.value))}
                className={input}
              />
            </label>
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <Checkbox checked={form.autoRenew} onChange={(e) => patchForm("autoRenew", e.target.checked)} />
                <span className="text-sm text-neutral-700 dark:text-neutral-200">Rinnovo automatico</span>
              </label>
              {form.autoRenew && (
                <label className="flex items-center gap-2">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">ogni</span>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={form.renewMonths}
                    onChange={(e) => patchForm("renewMonths", Number(e.target.value))}
                    className={`${input} w-16 shrink-0`}
                  />
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">mesi</span>
                </label>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <button type="button" onClick={closeEditor} className={btnNeutral}>
              Annulla
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </form>
      )}

      {!editorOpen && (
        <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome o email..."
            className={`${input} flex-1 sm:max-w-xs`}
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="ml-auto flex min-h-11 shrink-0 items-center gap-1.5 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Filtri
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center bg-yellow-400 px-1 text-[10px] font-semibold text-neutral-900">
                {activeFilterCount}
              </span>
            )}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {!editorOpen && filtersOpen && (
        <div className={`${card} mb-4 grid grid-cols-1 gap-3 p-3 sm:grid-cols-2`}>
          <label className="block">
            <span className={label}>Stato</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input}>
              <option value="">Tutti</option>
              <option value="ACTIVE">Attivo</option>
              <option value="EXPIRING">In scadenza</option>
              <option value="EXPIRED">Scaduto</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Servizio</span>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={input}>
              <option value="">Tutti</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {/* Da mobile non ci sono intestazioni di colonna cliccabili: stesso
              ordinamento delle colonne desktop via select + bottone direzione. */}
          <div className="flex gap-2 sm:hidden">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "client" | "service" | "end")}
              className={`${input} w-full flex-1`}
            >
              <option value="end">Ordina per scadenza</option>
              <option value="client">Ordina per cliente</option>
              <option value="service">Ordina per servizio</option>
            </select>
            <SortDirToggle
              active={sortActive}
              dir={sortDir}
              onChange={({ active, dir }) => {
                setSortActive(active);
                setSortDir(dir);
              }}
            />
          </div>
        </div>
      )}

      {loading && !editorOpen && <SkeletonCards />}

      {!loading && items.length === 0 && !editorOpen && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          Nessun abbonamento. Crea il primo con &quot;+ Nuovo abbonamento&quot;.
        </p>
      )}

      {/* Mobile: schede */}
      {sortedItems.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sortedItems.map((sub) => {
            const st = subStatus(sub);
            return (
              <div key={sub.id} className={`${card} p-4`}>
                <div className="flex items-center gap-2">
                  <StatusDot status={STATUS_DOT[st.key]} label={st.label} />
                  <Link
                    href={`/admin/clients/${sub.client.id}`}
                    className="flex-1 truncate font-medium text-neutral-900 hover:text-yellow-600 dark:text-white dark:hover:text-yellow-400"
                  >
                    {sub.client.firstName} {sub.client.lastName}
                  </Link>
                </div>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {sub.appointmentType.name} &middot; {formatCurrency(sub.appointmentType.unitPrice)} &middot; dal {formatDate(sub.startDate)}
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Scade il {formatDate(sub.endDate)}
                  {sub.autoRenew ? ` · rinnovo ogni ${sub.renewMonths} mese/i` : " · nessun rinnovo automatico"}
                </p>
                <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <ActionsMenu actions={subActions(sub)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {sortedItems.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <SortableTh label="Cliente" sortKey="client" active={sortBy === "client"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Servizio" sortKey="service" active={sortBy === "service"} dir={sortDir} onSort={handleSort} />
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
                        <Link
                          href={`/admin/clients/${sub.client.id}`}
                          className="font-medium hover:text-yellow-600 dark:hover:text-yellow-400"
                        >
                          {sub.client.lastName} {sub.client.firstName}
                        </Link>
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{sub.appointmentType.name}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(sub.startDate)}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(sub.endDate)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {sub.autoRenew ? `Ogni ${sub.renewMonths} mese/i` : "No"}
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
