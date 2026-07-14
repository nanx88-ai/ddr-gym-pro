"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { btnPrimary, td, th } from "@/lib/ui";
import { useToast } from "@/components/Toast";

type Tab = "anagrafica" | "abbonamenti" | "prenotazioni" | "fatture" | "scadenze" | "residenza";

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  status: string;
  notes: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  province: string | null;
  country: string;
  clientKind: string | null;
  businessName: string | null;
  fiscalCode: string | null;
  vatNumber: string | null;
  pec: string | null;
  sdiCode: string | null;
  subscriptions: Array<{
    id: string;
    tariff: { id: string; title: string; price: number };
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    renewMonths: number;
  }>;
  bookings: Array<{
    id: string;
    appointmentType: { id: string; name: string };
    startTime: string;
    endTime: string;
    status: string;
    attended: boolean | null;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    issueDate: string;
  }>;
  reminders: Array<{
    id: string;
    title: string;
    dueDate: string;
    notifiedAt: string | null;
  }>;
}

const sectionCard =
  "border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900";
const fieldInput =
  "w-full min-h-11 border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-yellow-400 dark:focus:ring-yellow-400";
const fieldLabel = "mb-1 block text-xs font-semibold uppercase text-neutral-500";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [tab, setTab] = useState<Tab>("anagrafica");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.client) setClient(data.client);
      })
      .catch(() => console.error("Errore caricamento cliente"))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveField(field: string, value: string | null) {
    if (!client) return;
    setSaving(field);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Errore salvataggio");
        return;
      }
      // La PATCH ritorna solo i campi scalari (Prisma update() non include
      // le relazioni): fondo nello stato esistente per non perdere
      // abbonamenti/prenotazioni/fatture/scadenze gia' caricate.
      setClient((prev) => (prev ? { ...prev, ...json.client } : json.client));
    } catch {
      toast.error("Errore di rete durante il salvataggio");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Caricamento...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Link href="/admin/clients" className={btnPrimary}>
          ← Indietro
        </Link>
        <p className="text-neutral-500">Cliente non trovato</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "anagrafica", label: "Anagrafica" },
    { id: "abbonamenti", label: "Abbonamenti", count: client.subscriptions.length },
    { id: "prenotazioni", label: "Prenotazioni", count: client.bookings.length },
    { id: "fatture", label: "Fatture", count: client.invoices.length },
    { id: "scadenze", label: "Scadenze", count: client.reminders.length },
    { id: "residenza", label: "Residenza" },
  ];

  const getSubscriptionStatus = (sub: ClientDetail["subscriptions"][0]) => {
    const today = new Date();
    const endDate = new Date(sub.endDate);
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { label: "SCADUTO", color: "text-red-600 dark:text-red-400" };
    if (daysLeft <= 7) return { label: "IN SCADENZA", color: "text-amber-600 dark:text-amber-400" };
    return { label: "ATTIVO", color: "text-green-600 dark:text-green-400" };
  };

  const getBookingStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING_APPROVAL: "text-amber-600 dark:text-amber-400",
      APPROVED: "text-green-600 dark:text-green-400",
      REJECTED: "text-red-600 dark:text-red-400",
      CANCELLED: "text-neutral-500 dark:text-neutral-400",
      RESCHEDULED: "text-blue-600 dark:text-blue-400",
    };
    return colors[status] || "text-neutral-500";
  };

  /** Campo di testo editabile inline: mostra un <input>, salva al blur solo se il valore e' cambiato. */
  function TextField({
    field,
    label,
    value,
    type = "text",
    colSpan,
  }: {
    field: string;
    label: string;
    value: string | null;
    type?: string;
    colSpan?: boolean;
  }) {
    return (
      <div className={colSpan ? "sm:col-span-2" : undefined}>
        <label className={fieldLabel}>{label}</label>
        <input
          type={type}
          defaultValue={value ?? ""}
          disabled={saving === field}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== value) saveField(field, v);
          }}
          className={fieldInput}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {client.firstName} {client.lastName}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{client.email}</p>
        </div>
        <Link href="/admin/clients" className={btnPrimary}>
          ← Indietro
        </Link>
      </div>

      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-1 overflow-x-auto sm:gap-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                tab === t.id
                  ? "border-yellow-500 text-yellow-600 dark:text-yellow-400"
                  : "border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-2 inline-block rounded-full bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`${sectionCard} p-4 sm:p-5`}>
        {tab === "anagrafica" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField field="firstName" label="Nome" value={client.firstName} />
            <TextField field="lastName" label="Cognome" value={client.lastName} />
            <TextField field="email" label="Email" value={client.email} type="email" />
            <TextField field="phone" label="Telefono" value={client.phone} type="tel" />
            <div>
              <label className={fieldLabel}>Sesso</label>
              <select
                defaultValue={client.sex ?? ""}
                onChange={(e) => saveField("sex", e.target.value || null)}
                className={fieldInput}
              >
                <option value="">—</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
                <option value="OTHER">Altro</option>
              </select>
            </div>
            <div>
              <label className={fieldLabel}>Data di nascita</label>
              <input
                type="date"
                defaultValue={client.dateOfBirth ? client.dateOfBirth.slice(0, 10) : ""}
                onBlur={(e) => {
                  const v = e.target.value ? `${e.target.value}T00:00:00.000Z` : null;
                  saveField("dateOfBirth", v);
                }}
                className={fieldInput}
              />
            </div>
            <div>
              <label className={fieldLabel}>Status</label>
              <select
                defaultValue={client.status}
                onChange={(e) => saveField("status", e.target.value)}
                className={fieldInput}
              >
                <option value="ACTIVE">Attivo</option>
                <option value="PAUSED">Sospeso</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabel}>Note</label>
              <textarea
                defaultValue={client.notes ?? ""}
                rows={3}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== client.notes) saveField("notes", v);
                }}
                className={fieldInput}
              />
            </div>
          </div>
        )}

        {tab === "abbonamenti" && (
          <div className="space-y-4">
            {client.subscriptions.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessun abbonamento</p>
            ) : (
              client.subscriptions.map((sub) => {
                const status = getSubscriptionStatus(sub);
                return (
                  <div key={sub.id} className="flex flex-col justify-between border-b border-neutral-200 pb-4 last:border-0 dark:border-neutral-800 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-neutral-900 dark:text-white">{sub.tariff.title}</p>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        Dal {formatDate(sub.startDate)} al {formatDate(sub.endDate)}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {sub.autoRenew ? `Rinnovo: +${sub.renewMonths} mese(i)` : "Nessun rinnovo"}
                      </p>
                    </div>
                    <div className="mt-3 text-right sm:mt-0 sm:ml-4">
                      <p className={`text-sm font-semibold ${status.color}`}>{status.label}</p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-white">{formatCurrency(sub.tariff.price)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "prenotazioni" && (
          <div>
            {client.bookings.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessuna prenotazione</p>
            ) : (
              <>
                {/* Mobile: schede */}
                <div className="space-y-2 sm:hidden">
                  {client.bookings
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .map((booking) => (
                      <div key={booking.id} className={`${sectionCard} space-y-1 px-4 py-3`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-900 dark:text-white">{booking.appointmentType.name}</span>
                          <span className={`text-xs font-medium ${getBookingStatusColor(booking.status)}`}>{booking.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                          <span>{formatDate(booking.startTime)} {formatTime(booking.startTime)}</span>
                          <span>{booking.attended === true ? "✓ Presente" : booking.attended === false ? "✗ Assente" : "—"}</span>
                        </div>
                      </div>
                    ))}
                </div>
                {/* Desktop: tabella */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800">
                        <th className={th}>Servizio</th>
                        <th className={th}>Data/Ora</th>
                        <th className={th}>Status</th>
                        <th className={th}>Presenza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.bookings
                        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                        .map((booking) => (
                          <tr key={booking.id} className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className={td}>{booking.appointmentType.name}</td>
                            <td className={td}>
                              <div className="whitespace-nowrap">
                                {formatDate(booking.startTime)} {formatTime(booking.startTime)}
                              </div>
                            </td>
                            <td className={`${td} ${getBookingStatusColor(booking.status)}`}>{booking.status}</td>
                            <td className={td}>{booking.attended === true ? "✓" : booking.attended === false ? "✗" : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "fatture" && (
          <div>
            {client.invoices.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessuna fattura</p>
            ) : (
              <>
                {/* Mobile: schede */}
                <div className="space-y-2 sm:hidden">
                  {client.invoices
                    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
                    .map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/admin/invoices/${invoice.id}`}
                        className={`${sectionCard} block space-y-1 px-4 py-3`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-900 dark:text-white">{invoice.number}</span>
                          <span className="text-sm font-semibold text-neutral-900 dark:text-white">{formatCurrency(invoice.total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                          <span>{formatDate(invoice.issueDate)}</span>
                          <span>{invoice.status}</span>
                        </div>
                      </Link>
                    ))}
                </div>
                {/* Desktop: tabella */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800">
                        <th className={th}>Numero</th>
                        <th className={th}>Data</th>
                        <th className={th}>Importo</th>
                        <th className={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.invoices
                        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
                        .map((invoice) => (
                          <tr key={invoice.id} className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className={td}>
                              <Link href={`/admin/invoices/${invoice.id}`} className="hover:text-yellow-600 hover:underline dark:hover:text-yellow-400">
                                {invoice.number}
                              </Link>
                            </td>
                            <td className={td}>{formatDate(invoice.issueDate)}</td>
                            <td className={td}>{formatCurrency(invoice.total)}</td>
                            <td className={td}>{invoice.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "scadenze" && (
          <div className="space-y-4">
            {client.reminders.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessuna scadenza</p>
            ) : (
              client.reminders.map((reminder) => (
                <div key={reminder.id} className="flex flex-col justify-between border-b border-neutral-200 pb-4 last:border-0 dark:border-neutral-800 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900 dark:text-white">{reminder.title}</p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Scade: {formatDate(reminder.dueDate)}</p>
                  </div>
                  <div className="mt-3 text-right sm:mt-0 sm:ml-4">
                    <p className="text-xs font-semibold text-neutral-500">
                      {reminder.notifiedAt ? "✓ Notificato" : "Pendente"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "residenza" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>Tipo cliente</label>
              <select
                defaultValue={client.clientKind ?? "PRIVATO"}
                onChange={(e) => saveField("clientKind", e.target.value)}
                className={fieldInput}
              >
                <option value="PRIVATO">Privato</option>
                <option value="AZIENDA">Azienda</option>
              </select>
            </div>
            {client.clientKind === "AZIENDA" && (
              <TextField field="businessName" label="Ragione sociale" value={client.businessName} />
            )}
            <TextField field="fiscalCode" label="Codice fiscale" value={client.fiscalCode} />
            {client.clientKind === "AZIENDA" && (
              <TextField field="vatNumber" label="Partita IVA" value={client.vatNumber} />
            )}
            <TextField field="address" label="Indirizzo" value={client.address} />
            <TextField field="zipCode" label="CAP" value={client.zipCode} />
            <TextField field="city" label="Città" value={client.city} />
            <TextField field="province" label="Provincia" value={client.province} />
            <TextField field="country" label="Paese" value={client.country} />
            <TextField field="pec" label="PEC" value={client.pec} type="email" />
            <TextField field="sdiCode" label="Codice SDI" value={client.sdiCode} />
          </div>
        )}
      </div>
    </div>
  );
}
