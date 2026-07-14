"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import {
  btnNeutral,
  btnPrimary,
  card,
  input,
  pageSubtitle,
  pageTitle,
} from "@/lib/ui";
import { INVOICE_PROVIDER_OPTIONS } from "@/lib/invoicing-provider-options";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatNature: string | null;
  amount: number;
}

interface Submission {
  id: string;
  provider: string;
  status: string;
  errorMessage: string | null;
  externalId: string | null;
  responsePayload: string | null;
  createdAt: string;
}

interface InvoiceDetail {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  status: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  lineItems: LineItem[];
  submissions: Submission[];
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    clientKind: string | null;
    businessName: string | null;
    fiscalCode: string | null;
    vatNumber: string | null;
    address: string | null;
    zipCode: string | null;
    city: string | null;
    province: string | null;
    country: string;
    sdiCode: string | null;
    pec: string | null;
  };
}

export default function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("manual");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/invoices/${id}`);
    const json = await res.json();
    setInvoice(json.invoice);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/invoices/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(json.error ?? "Errore durante l'invio.");
      return;
    }
    if (json.result?.status === "ERROR") {
      setError(json.result.errorMessage ?? "Invio non riuscito.");
    }
    load();
  }

  if (loading)
    return <p className="text-sm text-neutral-500">Caricamento...</p>;
  if (!invoice)
    return <p className="text-sm text-neutral-500">Fattura non trovata.</p>;

  const { client } = invoice;
  const clientDisplayName =
    client.clientKind === "AZIENDA" && client.businessName
      ? client.businessName
      : `${client.firstName} ${client.lastName}`;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/invoices"
        className="mb-3 inline-block text-sm text-neutral-500 dark:text-neutral-400 hover:underline print:hidden"
      >
        &larr; Torna alle fatture
      </Link>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className={pageTitle}>Fattura {invoice.number}</h1>
          <p className={pageSubtitle}>
            Stato:{""}
            <span
              className={`px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[invoice.status]}`}
            >
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
          </p>
          <Link
            href={`/admin/clients/${client.id}`}
            className="mt-1 inline-block text-sm text-yellow-600 hover:underline dark:text-yellow-400"
          >
            {clientDisplayName} →
          </Link>
        </div>
        <button onClick={() => window.print()} className={btnNeutral}>
          Stampa / Salva PDF
        </button>
      </div>

      {/* Documento stampabile */}
      <div
        className={`${card} mb-6 bg-white p-8 text-neutral-900 print:border-0 print:shadow-none`}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Fattura {invoice.number}</h2>
            <p className="text-sm text-neutral-600">
              Data emissione:{" "}
              {new Date(invoice.issueDate).toLocaleDateString("it-IT")}
            </p>
            <p className="text-sm text-neutral-600">
              Periodo:{" "}
              {new Date(invoice.periodStart).toLocaleDateString("it-IT")}{" "}
              &ndash;{""}
              {new Date(invoice.periodEnd).toLocaleDateString("it-IT")}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mb-1 text-xs font-semibold uppercase text-neutral-500">
            Destinatario
          </h3>
          <p className="font-medium">{clientDisplayName}</p>
          {client.fiscalCode && (
            <p className="text-sm">CF: {client.fiscalCode}</p>
          )}
          {client.vatNumber && (
            <p className="text-sm">P.IVA: {client.vatNumber}</p>
          )}
          {client.address && (
            <p className="text-sm">
              {client.address}, {client.zipCode} {client.city} (
              {client.province}) {client.country}
            </p>
          )}
          <p className="text-sm">{client.email}</p>
          {client.pec && <p className="text-sm">PEC: {client.pec}</p>}
          {client.sdiCode && (
            <p className="text-sm">Codice SDI: {client.sdiCode}</p>
          )}
          {!client.fiscalCode && !client.vatNumber && (
            <p className="mt-1 text-xs text-amber-700">
              Dati fiscali incompleti: completa l&apos;anagrafica cliente prima
              dell&apos;invio ufficiale.
            </p>
          )}
        </div>

        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500">
                <th className="py-1">Descrizione</th>
                <th className="py-1 text-right">Qta</th>
                <th className="py-1 text-right">Prezzo</th>
                <th className="py-1 text-right">IVA</th>
                <th className="py-1 text-right">Importo</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr key={li.id} className="border-b border-neutral-100">
                  <td className="py-1">{li.description}</td>
                  <td className="py-1 text-right">{li.quantity}</td>
                  <td className="py-1 text-right">
                    {formatCurrency(li.unitPrice)}
                  </td>
                  <td className="py-1 text-right">
                    {li.vatNature ? li.vatNature : `${li.vatRate}%`}
                  </td>
                  <td className="py-1 text-right">
                    {formatCurrency(li.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Imponibile</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">IVA</span>
            <span>{formatCurrency(invoice.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-neutral-300 pt-1 font-semibold">
            <span>Totale</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      <section className={`${card} mb-6 p-4 print:hidden`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
          Invio
        </h2>
        {error && (
          <div className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}
        <form onSubmit={handleSend} className="flex flex-wrap items-end gap-3">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={`${input} w-full sm:w-72`}
          >
            {INVOICE_PROVIDER_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={sending} className={btnPrimary}>
            {sending ? "Invio..." : "Invia"}
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          Aruba e Fatture in Cloud sono predisposti come integrazioni future: al
          momento restituiscono un errore esplicito perche&apos; non collegati a
          nessuna API reale. Usa &quot;Manuale&quot; per segnare la fattura come
          inviata.
        </p>
      </section>

      <section className={`${card} p-4 print:hidden`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
          Esiti degli invii
        </h2>
        <div className="space-y-2">
          {invoice.submissions.map((s) => (
            <div
              key={s.id}
              className="border border-neutral-200 dark:border-neutral-800 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-900 dark:text-white">
                  {s.provider}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}
                >
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {new Date(s.createdAt).toLocaleString("it-IT")}
              </div>
              {s.errorMessage && (
                <div className="mt-1 text-xs text-red-400">
                  {s.errorMessage}
                </div>
              )}
              {s.externalId && (
                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  ID esterno: {s.externalId}
                </div>
              )}
            </div>
          ))}
          {invoice.submissions.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nessun tentativo di invio.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
