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
  trBorder,
} from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { StatusDot } from "@/components/StatusDot";
import { SortableTh, type SortDir } from "@/components/SortableTh";
import { SkeletonCards, SkeletonLines } from "@/components/Skeleton";

interface Invoice {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  status: string;
  total: number;
  client: { id: string; firstName: string; lastName: string; email: string };
}

interface BillableClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  billingProfile: { active: boolean; billingType: string; serviceName: string; unitPrice: number } | null;
  lastInvoice: { periodEnd: string; issueDate: string } | null;
  dueForInvoicing: boolean;
  suggestedPeriodStart: string;
  suggestedPeriodEnd: string;
}

export default function AdminInvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"number" | "client" | "period" | "total">("period");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");

  // Flusso "Nuova fattura": chiuso finche' non si preme il bottone; una volta
  // aperto si sceglie il cliente, poi il periodo.
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [billableClients, setBillableClients] = useState<BillableClient[] | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<BillableClient | null>(null);
  const [genPeriodStart, setGenPeriodStart] = useState("");
  const [genPeriodEnd, setGenPeriodEnd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  function handleSort(key: "number" | "client" | "period" | "total") {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  function loadInvoices() {
    setLoading(true);
    fetch("/api/admin/invoices")
      .then((res) => res.json())
      .then((json) => {
        setInvoices(json.invoices ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  const activeFilterCount = [periodFrom, periodTo, minTotal, maxTotal].filter(Boolean).length;

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (q) {
        const haystack = `${inv.number} ${inv.client.firstName} ${inv.client.lastName} ${inv.client.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (periodFrom && new Date(inv.periodStart) < new Date(periodFrom)) return false;
      if (periodTo && new Date(inv.periodEnd) > new Date(periodTo)) return false;
      if (minTotal && inv.total < Number(minTotal)) return false;
      if (maxTotal && inv.total > Number(maxTotal)) return false;
      return true;
    });
  }, [invoices, search, periodFrom, periodTo, minTotal, maxTotal]);

  const sortedInvoices = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredInvoices].sort((a, b) => {
      if (sortBy === "number") return dir * a.number.localeCompare(b.number);
      if (sortBy === "client")
        return dir * `${a.client.firstName} ${a.client.lastName}`.localeCompare(`${b.client.firstName} ${b.client.lastName}`);
      if (sortBy === "total") return dir * (a.total - b.total);
      return dir * (new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    });
  }, [filteredInvoices, sortBy, sortDir]);

  function openCreator() {
    setCreatorOpen(true);
    setSelectedClient(null);
    setClientSearch("");
    setGenError(null);
    if (billableClients === null) {
      fetch("/api/admin/invoices/billable-clients")
        .then((res) => res.json())
        .then((json) => setBillableClients(json.clients ?? []));
    }
  }

  function closeCreator() {
    setCreatorOpen(false);
    setSelectedClient(null);
  }

  function pickClient(c: BillableClient) {
    setSelectedClient(c);
    setGenPeriodStart(c.suggestedPeriodStart);
    setGenPeriodEnd(c.suggestedPeriodEnd);
    setGenError(null);
  }

  const sortedBillable = useMemo(() => {
    if (!billableClients) return [];
    const q = clientSearch.trim().toLowerCase();
    const filtered = q
      ? billableClients.filter((c) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q))
      : billableClients;
    // Prima chi e' da fatturare, poi chi ha un profilo attivo ma non e' ancora
    // in scadenza, infine chi non ha un profilo di fatturazione configurato.
    return [...filtered].sort((a, b) => {
      const score = (c: BillableClient) => (c.dueForInvoicing ? 0 : c.billingProfile?.active ? 1 : 2);
      const s = score(a) - score(b);
      if (s !== 0) return s;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    });
  }, [billableClients, clientSearch]);

  async function generateInvoice() {
    if (!selectedClient) return;
    setGenerating(true);
    setGenError(null);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient.id,
        periodStart: genPeriodStart,
        periodEnd: genPeriodEnd,
      }),
    });
    setGenerating(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setGenError(json.error ?? "Errore durante la generazione della fattura.");
      return;
    }
    toast.success("Fattura generata.");
    closeCreator();
    loadInvoices();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Fatture</h1>
          <p className={pageSubtitle}>Documenti generati dai profili di fatturazione dei clienti.</p>
        </div>
        {!creatorOpen && (
          <button type="button" onClick={openCreator} className={`${btnPrimary} shrink-0 whitespace-nowrap`}>
            + Nuova fattura
          </button>
        )}
      </div>

      {creatorOpen && (
        <div className={`${card} mt-6 mb-6 p-4`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {selectedClient ? `Nuova fattura — ${selectedClient.firstName} ${selectedClient.lastName}` : "Nuova fattura — scegli il cliente"}
            </h2>
            <button type="button" onClick={closeCreator} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
              Chiudi
            </button>
          </div>

          {!selectedClient && (
            <>
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Cerca cliente per nome, cognome o email..."
                className={`${input} mb-3 w-full sm:max-w-xs`}
              />
              {billableClients === null && <SkeletonLines count={4} />}
              {billableClients !== null && (
                <div className="max-h-96 space-y-1.5 overflow-y-auto">
                  {sortedBillable.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickClient(c)}
                      disabled={!c.billingProfile}
                      className="flex w-full items-center justify-between gap-3 border border-neutral-200 p-3 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900 dark:text-white">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {c.billingProfile
                            ? `${c.billingProfile.serviceName} · ${formatCurrency(c.billingProfile.unitPrice)}`
                            : "Nessun profilo di fatturazione"}
                        </div>
                      </div>
                      {c.dueForInvoicing && (
                        <span className="shrink-0 border-2 border-yellow-500 px-2 py-1 text-xs font-semibold text-yellow-600 dark:border-yellow-400 dark:text-yellow-400">
                          Da fatturare
                        </span>
                      )}
                      {!c.dueForInvoicing && c.billingProfile?.active && (
                        <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                          Fatturato fino al {formatDate(c.lastInvoice!.periodEnd)}
                        </span>
                      )}
                    </button>
                  ))}
                  {sortedBillable.length === 0 && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun cliente trovato.</p>
                  )}
                </div>
              )}
            </>
          )}

          {selectedClient && (
            <div>
              {genError && (
                <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                  {genError}
                </div>
              )}
              <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                {selectedClient.billingProfile?.billingType === "PER_ACCESS"
                  ? "Fatturazione in base agli accessi effettivi nel periodo scelto."
                  : "Importo fisso per il periodo scelto."}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className={label}>Da</span>
                  <input type="date" value={genPeriodStart} onChange={(e) => setGenPeriodStart(e.target.value)} className={`${input} w-40`} />
                </label>
                <label className="block">
                  <span className={label}>A</span>
                  <input type="date" value={genPeriodEnd} onChange={(e) => setGenPeriodEnd(e.target.value)} className={`${input} w-40`} />
                </label>
                <button type="button" onClick={() => setSelectedClient(null)} className={btnNeutral}>
                  Cambia cliente
                </button>
                <button type="button" onClick={generateInvoice} disabled={generating} className={btnPrimary}>
                  {generating ? "Generazione..." : "Genera fattura"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!creatorOpen && (
        <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, cognome o numero fattura..."
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

      {!creatorOpen && filtersOpen && (
        <div className={`${card} mb-4 grid grid-cols-1 gap-3 p-3 sm:grid-cols-4`}>
          <label className="block">
            <span className={label}>Periodo da</span>
            <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Periodo a</span>
            <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Totale min &euro;</span>
            <input type="number" min={0} value={minTotal} onChange={(e) => setMinTotal(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Totale max &euro;</span>
            <input type="number" min={0} value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} className={input} />
          </label>
        </div>
      )}

      {!creatorOpen && loading && <SkeletonCards />}

      {!creatorOpen && !loading && sortedInvoices.length === 0 && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          {invoices.length === 0 ? 'Nessuna fattura generata. Crea la prima con "+ Nuova fattura".' : "Nessuna fattura corrisponde ai filtri."}
        </p>
      )}

      {/* Mobile: schede */}
      {!creatorOpen && sortedInvoices.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sortedInvoices.map((inv) => (
            <Link key={inv.id} href={`/admin/invoices/${inv.id}`} className={`${card} block p-4`}>
              <div className="flex items-center gap-2">
                <StatusDot status={inv.status} />
                <span className="font-medium text-neutral-900 dark:text-white">{inv.number}</span>
              </div>
              <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {inv.client.firstName} {inv.client.lastName}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">
                  {formatDate(inv.periodStart)} &ndash; {formatDate(inv.periodEnd)}
                </span>
                <span className="font-medium text-neutral-900 dark:text-white">{formatCurrency(inv.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {!creatorOpen && sortedInvoices.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <SortableTh label="Numero" sortKey="number" active={sortBy === "number"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Cliente" sortKey="client" active={sortBy === "client"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Periodo" sortKey="period" active={sortBy === "period"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Totale" sortKey="total" active={sortBy === "total"} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.map((inv) => (
                <tr key={inv.id} className={trBorder}>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      <StatusDot status={inv.status} />
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="font-medium text-neutral-900 dark:text-white hover:text-yellow-400 hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </div>
                  </td>
                  <td className={td}>
                    <Link
                      href={`/admin/clients/${inv.client.id}`}
                      className="hover:text-yellow-600 hover:underline dark:hover:text-yellow-400"
                    >
                      {inv.client.firstName} {inv.client.lastName}
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {formatDate(inv.periodStart)} &ndash; {formatDate(inv.periodEnd)}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatCurrency(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
