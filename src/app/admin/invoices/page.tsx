"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import {
  card,
  pageSubtitle,
  pageTitle,
  tableWrap,
  td,
  th,
  trBorder,
} from "@/lib/ui";

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
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/admin/invoices/${inv.id}`}
              className={`${card} block p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-neutral-900 dark:text-white">
                  {inv.number}
                </span>
                <span
                  className={`shrink-0 px-2 py-1 text-xs font-medium ${STATUS_COLORS[inv.status]}`}
                >
                  {STATUS_LABELS[inv.status] ?? inv.status}
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
                <th className={`${th} whitespace-nowrap`}>Numero</th>
                <th className={th}>Cliente</th>
                <th className={`${th} whitespace-nowrap`}>Periodo</th>
                <th className={`${th} whitespace-nowrap`}>Totale</th>
                <th className={`${th} whitespace-nowrap`}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className={trBorder}>
                  <td className={td}>
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="font-medium text-neutral-900 dark:text-white hover:text-yellow-400 hover:underline"
                    >
                      {inv.number}
                    </Link>
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
                  <td className={td}>
                    <span
                      className={`px-2 py-1 text-xs font-medium ${STATUS_COLORS[inv.status]}`}
                    >
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
