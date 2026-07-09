"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { pageSubtitle, pageTitle, tableWrap, td, th, trBorder } from "@/lib/ui";

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
        Documenti generati dai profili di fatturazione dei clienti. Per generarne una nuova, vai sulla scheda del
        cliente.
      </p>

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
            <tr>
              <th className={th}>Numero</th>
              <th className={th}>Cliente</th>
              <th className={th}>Periodo</th>
              <th className={th}>Totale</th>
              <th className={th}>Stato</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className={trBorder}>
                <td className={td}>
                  <Link href={`/admin/invoices/${inv.id}`} className="font-medium text-neutral-900 dark:text-white hover:text-yellow-400 hover:underline">
                    {inv.number}
                  </Link>
                </td>
                <td className={td}>
                  {inv.client.firstName} {inv.client.lastName}
                </td>
                <td className={td}>
                  {new Date(inv.periodStart).toLocaleDateString("it-IT")} &ndash;{" "}
                  {new Date(inv.periodEnd).toLocaleDateString("it-IT")}
                </td>
                <td className={td}>{formatCurrency(inv.total)}</td>
                <td className={td}>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nessuna fattura generata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
