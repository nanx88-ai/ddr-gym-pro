"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { btnDanger, btnNeutral, btnPositive, btnPrimary, card, input, label, pageSubtitle, pageTitle } from "@/lib/ui";

/**
 * Affidabilita' del cliente: quota di prenotazioni concluse (confermate,
 * spostate, annullate, non presentato) che si sono chiuse bene (confermata e
 * presenza non segnata come assente), rispetto al totale. Le richieste
 * ancora in attesa non contano ne' a favore ne' contro.
 */
function ReliabilityBadge({ bookings }: { bookings: Booking[] }) {
  const finalized = bookings.filter((b) => ["APPROVED", "RESCHEDULED", "REJECTED", "CANCELLED"].includes(b.status));
  if (finalized.length === 0) return null;

  const rescheduled = finalized.filter((b) => b.status === "RESCHEDULED").length;
  const cancelled = finalized.filter((b) => b.status === "CANCELLED").length;
  const noShow = finalized.filter((b) => b.attended === false).length;
  const negative = rescheduled + cancelled + noShow;
  const rate = Math.round(100 * (1 - negative / finalized.length));

  const color =
    rate >= 80
      ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400"
      : rate >= 50
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300"
        : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>Affidabilita': {rate}%</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        su {finalized.length} prenotazion{finalized.length === 1 ? "e" : "i"} concluse
        {rescheduled > 0 && ` · ${rescheduled} spostat${rescheduled === 1 ? "a" : "e"}`}
        {cancelled > 0 && ` · ${cancelled} annullat${cancelled === 1 ? "a" : "e"}`}
        {noShow > 0 && ` · ${noShow} assenz${noShow === 1 ? "a" : "e"}`}
      </span>
    </div>
  );
}

interface PriceListItem {
  id: string;
  name: string;
  unitPrice: number;
  vatRate: number;
  vatNature: string | null;
}

interface BillingProfile {
  id: string;
  priceListItemId: string;
  billingType: string;
  active: boolean;
  priceListItem: PriceListItem;
}

interface Booking {
  id: string;
  startTime: string;
  status: string;
  attended: boolean | null;
  appointmentType: { name: string };
}

interface Invoice {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  status: string;
  total: number;
}

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  notifyDaysBefore: number;
  notifiedAt: string | null;
}

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  notes: string | null;
  clientKind: string | null;
  businessName: string | null;
  fiscalCode: string | null;
  vatNumber: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  province: string | null;
  country: string;
  pec: string | null;
  sdiCode: string | null;
  billingProfile: BillingProfile | null;
  bookings: Booking[];
  invoices: Invoice[];
  reminders: Reminder[];
}

export default function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDescription, setReminderDescription] = useState("");
  const [reminderDueDate, setReminderDueDate] = useState("");
  const [reminderNotifyDays, setReminderNotifyDays] = useState(7);
  const [addingReminder, setAddingReminder] = useState(false);

  const [fiscal, setFiscal] = useState({
    clientKind: "PRIVATO",
    businessName: "",
    fiscalCode: "",
    vatNumber: "",
    address: "",
    zipCode: "",
    city: "",
    province: "",
    country: "IT",
    pec: "",
    sdiCode: "",
    phone: "",
  });

  const [priceListItemId, setPriceListItemId] = useState("");
  const [billingType, setBillingType] = useState("PER_ACCESS");

  const now = new Date();
  const [periodStart, setPeriodStart] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [periodEnd, setPeriodEnd] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-01`
  );

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/clients/${id}`);
    const json = await res.json();
    setClient(json.client);
    if (json.client) {
      setFiscal({
        clientKind: json.client.clientKind ?? "PRIVATO",
        businessName: json.client.businessName ?? "",
        fiscalCode: json.client.fiscalCode ?? "",
        vatNumber: json.client.vatNumber ?? "",
        address: json.client.address ?? "",
        zipCode: json.client.zipCode ?? "",
        city: json.client.city ?? "",
        province: json.client.province ?? "",
        country: json.client.country ?? "IT",
        pec: json.client.pec ?? "",
        sdiCode: json.client.sdiCode ?? "",
        phone: json.client.phone ?? "",
      });
      if (json.client.billingProfile) {
        setPriceListItemId(json.client.billingProfile.priceListItemId);
        setBillingType(json.client.billingProfile.billingType);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/admin/price-list")
      .then((res) => res.json())
      .then((json) => {
        setPriceList(json.items ?? []);
        setPriceListItemId((prev) => prev || json.items?.[0]?.id || "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveFiscal(e: React.FormEvent) {
    e.preventDefault();
    setSavingFiscal(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fiscal),
    });
    setSavingFiscal(false);
    if (!res.ok) {
      setError("Errore durante il salvataggio dei dati fiscali.");
      return;
    }
    setMessage("Dati fiscali salvati.");
    load();
  }

  async function saveBilling(e: React.FormEvent) {
    e.preventDefault();
    setSavingBilling(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/billing-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, priceListItemId, billingType, active: true }),
    });
    setSavingBilling(false);
    if (!res.ok) {
      setError("Errore durante il salvataggio del profilo di fatturazione.");
      return;
    }
    setMessage("Profilo di fatturazione salvato.");
    load();
  }

  async function setAttendance(bookingId: string, attended: boolean | null) {
    await fetch(`/api/admin/bookings/${bookingId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended }),
    });
    load();
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderDueDate) return;
    setAddingReminder(true);
    await fetch(`/api/admin/clients/${id}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: reminderTitle,
        description: reminderDescription || undefined,
        dueDate: reminderDueDate,
        notifyDaysBefore: reminderNotifyDays,
      }),
    });
    setReminderTitle("");
    setReminderDescription("");
    setReminderDueDate("");
    setReminderNotifyDays(7);
    setAddingReminder(false);
    load();
  }

  async function deleteReminder(reminderId: string) {
    if (!window.confirm("Eliminare questa scadenza?")) return;
    await fetch(`/api/admin/reminders/${reminderId}`, { method: "DELETE" });
    load();
  }

  async function generateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, periodStart, periodEnd }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(json.error ?? "Errore durante la generazione della fattura.");
      return;
    }
    setMessage(`Fattura ${json.invoice.number} generata.`);
    load();
  }

  if (loading) return <p className="text-sm text-neutral-500">Caricamento...</p>;
  if (!client) return <p className="text-sm text-neutral-500">Cliente non trovato.</p>;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clients" className="mb-3 inline-block text-sm text-neutral-500 dark:text-neutral-400 hover:underline">
        &larr; Torna ai clienti
      </Link>
      <h1 className={pageTitle}>
        {client.firstName} {client.lastName}
      </h1>
      <p className={pageSubtitle}>
        {client.email} {client.phone ? `· ${client.phone}` : ""}
      </p>

      <ReliabilityBadge bookings={client.bookings} />

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          {message}
        </div>
      )}

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Dati anagrafici e fiscali</h2>
        <form onSubmit={saveFiscal} className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Tipo cliente</span>
            <select
              value={fiscal.clientKind}
              onChange={(e) => setFiscal({ ...fiscal, clientKind: e.target.value })}
              className={input}
            >
              <option value="PRIVATO">Privato</option>
              <option value="AZIENDA">Azienda</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Telefono</span>
            <input
              value={fiscal.phone}
              onChange={(e) => setFiscal({ ...fiscal, phone: e.target.value })}
              className={input}
            />
          </label>

          {fiscal.clientKind === "AZIENDA" && (
            <>
              <label className="col-span-2 block">
                <span className={label}>Ragione sociale</span>
                <input
                  value={fiscal.businessName}
                  onChange={(e) => setFiscal({ ...fiscal, businessName: e.target.value })}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>Partita IVA</span>
                <input
                  value={fiscal.vatNumber}
                  onChange={(e) => setFiscal({ ...fiscal, vatNumber: e.target.value })}
                  className={input}
                />
              </label>
            </>
          )}

          <label className="block">
            <span className={label}>Codice fiscale</span>
            <input
              value={fiscal.fiscalCode}
              onChange={(e) => setFiscal({ ...fiscal, fiscalCode: e.target.value })}
              className={input}
            />
          </label>
          <label className="col-span-2 block">
            <span className={label}>Indirizzo</span>
            <input
              value={fiscal.address}
              onChange={(e) => setFiscal({ ...fiscal, address: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>CAP</span>
            <input
              value={fiscal.zipCode}
              onChange={(e) => setFiscal({ ...fiscal, zipCode: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Citta&apos;</span>
            <input
              value={fiscal.city}
              onChange={(e) => setFiscal({ ...fiscal, city: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Provincia</span>
            <input
              value={fiscal.province}
              onChange={(e) => setFiscal({ ...fiscal, province: e.target.value })}
              className={input}
              maxLength={2}
            />
          </label>
          <label className="block">
            <span className={label}>Paese</span>
            <input
              value={fiscal.country}
              onChange={(e) => setFiscal({ ...fiscal, country: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>PEC</span>
            <input
              value={fiscal.pec}
              onChange={(e) => setFiscal({ ...fiscal, pec: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Codice destinatario SDI</span>
            <input
              value={fiscal.sdiCode}
              onChange={(e) => setFiscal({ ...fiscal, sdiCode: e.target.value })}
              className={input}
              maxLength={7}
            />
          </label>

          <div className="col-span-2">
            <button type="submit" disabled={savingFiscal} className={btnPrimary}>
              {savingFiscal ? "Salvataggio..." : "Salva dati fiscali"}
            </button>
          </div>
        </form>
      </section>

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Profilo di fatturazione</h2>
        <form onSubmit={saveBilling} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={label}>Voce di listino</span>
            <select value={priceListItemId} onChange={(e) => setPriceListItemId(e.target.value)} className={`${input} w-56`}>
              {priceList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.unitPrice)})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Regola di conteggio</span>
            <select value={billingType} onChange={(e) => setBillingType(e.target.value)} className={`${input} w-56`}>
              <option value="PER_ACCESS">Per accessi effettivi</option>
              <option value="FLAT">Importo fisso per periodo</option>
            </select>
          </label>
          <button type="submit" disabled={savingBilling} className={btnPrimary}>
            {savingBilling ? "Salvataggio..." : "Salva profilo"}
          </button>
        </form>
        {priceList.length === 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            Nessuna voce di listino disponibile: creane una in{" "}
            <Link href="/admin/price-list" className="text-yellow-400 hover:underline">
              Listino
            </Link>
            .
          </p>
        )}
      </section>

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Storico prenotazioni e presenze</h2>
        <div className="space-y-1">
          {client.bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 py-2 last:border-0">
              <div>
                <span className="text-sm capitalize text-neutral-900 dark:text-white">{formatDateTime(b.startTime)}</span>{" "}
                <span className="text-xs text-neutral-500">{b.appointmentType.name}</span>{" "}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                  {STATUS_LABELS[b.status] ?? b.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAttendance(b.id, true)}
                  className={b.attended === true ? btnPositive : btnNeutral}
                >
                  Presente
                </button>
                <button
                  onClick={() => setAttendance(b.id, false)}
                  className={b.attended === false ? btnDanger : btnNeutral}
                >
                  Assente
                </button>
              </div>
            </div>
          ))}
          {client.bookings.length === 0 && <p className="text-sm text-neutral-500">Nessuna prenotazione.</p>}
        </div>
      </section>

      <section className={`${card} mb-6 p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Scadenze</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Es. fine abbonamento, certificato medico: titolo e descrizione a scelta. Un cron giornaliero avvisa te e il
          cliente via email quando manca il numero di giorni indicato.
        </p>

        <form onSubmit={addReminder} className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-4">
          <label className="col-span-2 block sm:col-span-1">
            <span className={label}>Titolo</span>
            <input
              required
              placeholder="es. Certificato medico"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              className={input}
            />
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className={label}>Scadenza</span>
            <input
              required
              type="date"
              value={reminderDueDate}
              onChange={(e) => setReminderDueDate(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Avvisa (giorni prima)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={reminderNotifyDays}
              onChange={(e) => setReminderNotifyDays(Number(e.target.value) || 0)}
              className={input}
            />
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className={label}>Descrizione (facoltativa)</span>
            <input
              value={reminderDescription}
              onChange={(e) => setReminderDescription(e.target.value)}
              className={input}
            />
          </label>
          <div className="col-span-2 sm:col-span-4">
            <button type="submit" disabled={addingReminder} className={btnPositive}>
              {addingReminder ? "Aggiunta..." : "Aggiungi scadenza"}
            </button>
          </div>
        </form>

        <div className="space-y-1">
          {client.reminders.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 py-2 last:border-0 dark:border-neutral-800"
            >
              <div>
                <span className="text-sm font-medium text-neutral-900 dark:text-white">{r.title}</span>{" "}
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  scade il {new Date(r.dueDate).toLocaleDateString("it-IT")} · avviso {r.notifyDaysBefore}g prima
                </span>
                {r.description && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{r.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.notifiedAt ? (
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    Notificata
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300">
                    In attesa
                  </span>
                )}
                <button onClick={() => deleteReminder(r.id)} className={btnDanger}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
          {client.reminders.length === 0 && <p className="text-sm text-neutral-500">Nessuna scadenza impostata.</p>}
        </div>
      </section>

      <section className={`${card} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Fatture</h2>

        <form onSubmit={generateInvoice} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={label}>Da</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className={`${input} w-40`}
            />
          </label>
          <label className="block">
            <span className={label}>A</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className={`${input} w-40`}
            />
          </label>
          <button type="submit" disabled={generating || !client.billingProfile} className={btnPositive}>
            {generating ? "Generazione..." : "Genera fattura"}
          </button>
          {!client.billingProfile && (
            <span className="text-xs text-neutral-500">Imposta prima un profilo di fatturazione.</span>
          )}
        </form>

        <div className="space-y-1">
          {client.invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/admin/invoices/${inv.id}`}
              className="flex items-center justify-between rounded-md border-b border-neutral-200 dark:border-neutral-800 py-2 text-sm last:border-0 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            >
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">{inv.number}</span>{" "}
                <span className="text-xs text-neutral-500">
                  {new Date(inv.periodStart).toLocaleDateString("it-IT")} &ndash;{" "}
                  {new Date(inv.periodEnd).toLocaleDateString("it-IT")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-neutral-700 dark:text-neutral-300">{formatCurrency(inv.total)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </span>
              </div>
            </Link>
          ))}
          {client.invoices.length === 0 && <p className="text-sm text-neutral-500">Nessuna fattura generata.</p>}
        </div>
      </section>
    </div>
  );
}
