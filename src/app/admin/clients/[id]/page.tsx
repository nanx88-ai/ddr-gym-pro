"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { btnPrimary, card, td, th } from "@/lib/ui";

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

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [tab, setTab] = useState<Tab>("anagrafica");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.client) setClient(data.client);
      })
      .catch(() => console.error("Errore caricamento cliente"))
      .finally(() => setLoading(false));
  }, [id]);

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
          ← Torna ai clienti
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

      <div className={card}>
        {tab === "anagrafica" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Nome</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.firstName}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Cognome</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.lastName}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Email</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.email}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Telefono</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.phone || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Sesso</label>
              <p className="mt-1 text-neutral-900 dark:text-white">
                {client.sex === "M" ? "Maschio" : client.sex === "F" ? "Femmina" : client.sex || "—"}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Data di nascita</label>
              <p className="mt-1 text-neutral-900 dark:text-white">
                {client.dateOfBirth ? formatDate(client.dateOfBirth) : "—"}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Status</label>
              <p className="mt-1 text-neutral-900 dark:text-white">
                {client.status === "ACTIVE" ? "Attivo" : "Sospeso"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-neutral-500">Note</label>
              <p className="mt-1 whitespace-pre-line text-neutral-900 dark:text-white">{client.notes || "—"}</p>
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
              <div className="overflow-x-auto">
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
                    {client.bookings.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((booking) => (
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
            )}
          </div>
        )}

        {tab === "fatture" && (
          <div>
            {client.invoices.length === 0 ? (
              <p className="text-sm text-neutral-500">Nessuna fattura</p>
            ) : (
              <div className="overflow-x-auto">
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
                    {client.invoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).map((invoice) => (
                      <tr key={invoice.id} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className={td}>{invoice.number}</td>
                        <td className={td}>{formatDate(invoice.issueDate)}</td>
                        <td className={td}>{formatCurrency(invoice.total)}</td>
                        <td className={td}>{invoice.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <label className="text-xs font-semibold uppercase text-neutral-500">Tipo cliente</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.clientKind === "AZIENDA" ? "Azienda" : "Privato"}</p>
            </div>
            {client.clientKind === "AZIENDA" && (
              <div>
                <label className="text-xs font-semibold uppercase text-neutral-500">Ragione sociale</label>
                <p className="mt-1 text-neutral-900 dark:text-white">{client.businessName || "—"}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Codice fiscale</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.fiscalCode || "—"}</p>
            </div>
            {client.clientKind === "AZIENDA" && (
              <div>
                <label className="text-xs font-semibold uppercase text-neutral-500">Partita IVA</label>
                <p className="mt-1 text-neutral-900 dark:text-white">{client.vatNumber || "—"}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Indirizzo</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.address || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">CAP</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.zipCode || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Città</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.city || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Provincia</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.province || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Paese</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.country}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">PEC</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.pec || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-neutral-500">Codice SDI</label>
              <p className="mt-1 text-neutral-900 dark:text-white">{client.sdiCode || "—"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
