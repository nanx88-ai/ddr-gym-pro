"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import {
  card,
  pageSubtitle,
  pageTitle,
  tableWrap,
  td,
  trBorder,
} from "@/lib/ui";
import { StatusDot } from "@/components/StatusDot";
import { SortableTh, type SortDir } from "@/components/SortableTh";

interface Invoice {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  status: string;
  total: number;
  client: { firstName: string; lastName: string; email: string };
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"number" | "client" | "period" | "total">("period");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: "number" | "client" | "period" | "total") {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortedInvoices = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...invoices].sort((a, b) => {
      if (sortBy === "number") return dir * a.number.localeCompare(b.number);
      if (sortBy === "client")
        return dir * `${a.client.firstName} ${a.client.lastName}`.localeCompare(`${b.client.firstName} ${b.client.lastName}`);
      if (sortBy === "total") return dir * (a.total - b.total);
      return dir * (new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    });
  }, [invoices, sortBy, sortDir]);

  useEffect(() => {
    fetch("/api/admin/invoices")
      .then((res) => res.json())
      .then((json) => {
        setInvoices(json.invoices ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1 className={pageTitle}>Fatture</h1>
      <p className={pageSubtitle}>
        Documenti generati dai profili di fatturazione dei clienti. Per
        generarne una nuova, vai sulla scheda del cliente.
      </p>

      {!loading && invoices.length === 0 && (
        <p
          className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}
        >
          Nessuna fattura generata.
        </p>
      )}

      {/* Mobile: schede */}
      {invoices.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sortedInvoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/admin/invoices/${inv.id}`}
              className={`${card} block p-4`}
            >
              <div className="flex items-center gap-2">
                <StatusDot status={inv.status} />
                <span className="font-medium text-neutral-900 dark:text-white">
                  {inv.number}
                </span>
              </div>
              <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {inv.client.firstName} {inv.client.lastName}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">
                  {new Date(inv.periodStart).toLocaleDateString("it-IT")}{" "}
                  &ndash;{""}
                  {new Date(inv.periodEnd).toLocaleDateString("it-IT")}
                </span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {formatCurrency(inv.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {invoices.length > 0 && (
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
                  <td className={td}>
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
                    {inv.client.firstName} {inv.client.lastName}
                  </td>
                  <td className={td}>
                    {new Date(inv.periodStart).toLocaleDateString("it-IT")}{" "}
                    &ndash;{""}
                    {new Date(inv.periodEnd).toLocaleDateString("it-IT")}
                  </td>
                  <td className={td}>{formatCurrency(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
