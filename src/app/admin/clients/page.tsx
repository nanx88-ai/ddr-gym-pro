"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { card, checkbox, input, pageSubtitle, pageTitle, tableHeadBg, tableWrap, td, th, trBorder } from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionsRow, IconButton, IconLink } from "@/components/IconAction";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  fiscalCode: string | null;
  vatNumber: string | null;
  clientKind: string | null;
  _count: { bookings: number };
  bookings: { startTime: string; appointmentTypeId: string; appointmentType: { name: string } }[];
  reminders: { dueDate: string; title: string }[];
}

type SortBy = "name" | "bookingsDesc" | "bookingsAsc";

export default function AdminClientsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [incompleteFiscal, setIncompleteFiscal] = useState(false);
  const [hasUpcomingReminder, setHasUpcomingReminder] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/appointment-types?all=1")
      .then((res) => res.json())
      .then((json) => setTypes(json.appointmentTypes ?? []));
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/clients");
    const json = await res.json();
    setClients(json.clients ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const visibleClients = useMemo(() => {
    const now = Date.now();
    const filtered = clients.filter((c) => {
      if (!showArchived && c.status === "ARCHIVED") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (appointmentTypeId && !c.bookings.some((b) => b.appointmentTypeId === appointmentTypeId)) return false;
      if (inactiveDays) {
        const days = Number(inactiveDays);
        const lastBooking = c.bookings.reduce<number>((max, b) => Math.max(max, new Date(b.startTime).getTime()), 0);
        const daysSince = lastBooking === 0 ? Infinity : (now - lastBooking) / 86400000;
        if (daysSince < days) return false;
      }
      if (incompleteFiscal && (c.fiscalCode || c.vatNumber)) return false;
      if (hasUpcomingReminder && c.reminders.length === 0) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "bookingsDesc") return b._count.bookings - a._count.bookings;
      if (sortBy === "bookingsAsc") return a._count.bookings - b._count.bookings;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [clients, search, showArchived, appointmentTypeId, inactiveDays, incompleteFiscal, hasUpcomingReminder, sortBy]);

  const activeFilterCount =
    (appointmentTypeId ? 1 : 0) +
    (inactiveDays ? 1 : 0) +
    (incompleteFiscal ? 1 : 0) +
    (hasUpcomingReminder ? 1 : 0) +
    (sortBy !== "name" ? 1 : 0);

  async function setStatus(client: Client, status: string, confirmMsg?: string) {
    if (confirmMsg && !(await confirm(confirmMsg))) return;
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function togglePause(client: Client) {
    const next = client.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await setStatus(
      client,
      next,
      next === "PAUSED"
        ? `Mettere in pausa ${client.firstName} ${client.lastName}? Non potra' prenotare finche' non lo riattivi.`
        : undefined
    );
    toast.success(next === "PAUSED" ? "Cliente messo in pausa." : "Cliente riattivato.");
  }

  async function archive(client: Client) {
    if (
      !(await confirm({
        message: `Archiviare ${client.firstName} ${client.lastName}? Non potra' prenotare finche' non lo riattivi. Storico e dati restano intatti.`,
        confirmLabel: "Archivia",
      }))
    ) {
      return;
    }
    await setStatus(client, "ARCHIVED");
    toast.success("Cliente archiviato.");
  }

  async function unarchive(client: Client) {
    await setStatus(client, "ACTIVE");
    toast.success("Cliente riattivato.");
  }

  return (
    <div>
      <h1 className={pageTitle}>Anagrafica clienti</h1>
      <p className={pageSubtitle}>
        Gap custom rispetto a Koalendar: qui gestiamo stato attivo/in pausa/archiviato e dati aggiuntivi non presenti
        nella sezione Contatti nativa.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome o email..."
          className={`${input} flex-1 sm:max-w-xs`}
        />
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className={checkbox}
          />
          Mostra archiviati
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-1.5 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
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

      {filtersOpen && (
        <div className={`${card} mb-4 grid grid-cols-1 gap-2 p-3 sm:grid-cols-3`}>
          <select value={appointmentTypeId} onChange={(e) => setAppointmentTypeId(e.target.value)} className={`${input} w-full`}>
            <option value="">Qualsiasi servizio</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                Ha prenotato: {t.name}
              </option>
            ))}
          </select>
          <select value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} className={`${input} w-full`}>
            <option value="">Attivita': tutti</option>
            <option value="30">Inattivi da 30+ giorni</option>
            <option value="60">Inattivi da 60+ giorni</option>
            <option value="90">Inattivi da 90+ giorni</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={`${input} w-full`}>
            <option value="name">Ordina per nome</option>
            <option value="bookingsDesc">Piu' prenotazioni prima</option>
            <option value="bookingsAsc">Meno prenotazioni prima</option>
          </select>
          <label
            className={`${input} w-full flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <input
              type="checkbox"
              checked={incompleteFiscal}
              onChange={(e) => setIncompleteFiscal(e.target.checked)}
              className={checkbox}
            />
            Dati fiscali incompleti
          </label>
          <label
            className={`${input} w-full flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <input
              type="checkbox"
              checked={hasUpcomingReminder}
              onChange={(e) => setHasUpcomingReminder(e.target.checked)}
              className={checkbox}
            />
            Con scadenze in arrivo
          </label>
        </div>
      )}

      {!loading && visibleClients.length === 0 && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          Nessun cliente trovato.
        </p>
      )}

      {/* Mobile: schede */}
      {visibleClients.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {visibleClients.map((c) => (
            <div key={c.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/clients/${c.id}`} className="font-medium text-neutral-900 hover:underline dark:text-white">
                  {c.firstName} {c.lastName}
                </Link>
                <span className={`shrink-0 px-2 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{c.email}</div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-300">{c.phone ?? "Nessun telefono"}</span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {c._count.bookings} prenotazion{c._count.bookings === 1 ? "e" : "i"}
                </span>
              </div>
              <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <ActionsRow>
                  <IconLink href={`/admin/clients/${c.id}`} icon="expand" label="Espandi" />
                  {c.status !== "ARCHIVED" && (
                    <IconButton
                      onClick={() => togglePause(c)}
                      icon={c.status === "ACTIVE" ? "pause" : "resume"}
                      label={c.status === "ACTIVE" ? "Pausa" : "Riattiva"}
                    />
                  )}
                  {c.status === "ARCHIVED" ? (
                    <IconButton onClick={() => unarchive(c)} icon="unarchive" label="Riattiva" />
                  ) : (
                    <IconButton onClick={() => archive(c)} icon="archive" label="Archivia" tone="danger" />
                  )}
                </ActionsRow>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {visibleClients.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className={tableHeadBg}>
              <tr>
                <th className={th}>Nome</th>
                <th className={th}>Email</th>
                <th className={th}>Telefono</th>
                <th className={th}>Prenotazioni</th>
                <th className={th}>Stato</th>
                <th className={th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((c) => (
                <tr key={c.id} className={trBorder}>
                  <td className={`${td} font-medium text-neutral-900 dark:text-white`}>
                    <Link href={`/admin/clients/${c.id}`} className="hover:text-yellow-400 hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className={td}>{c.email}</td>
                  <td className={td}>{c.phone ?? "-"}</td>
                  <td className={td}>{c._count.bookings}</td>
                  <td className={td}>
                    <span className={`px-2 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className={td}>
                    <ActionsRow>
                      <IconLink href={`/admin/clients/${c.id}`} icon="expand" label="Espandi" />
                      {c.status !== "ARCHIVED" && (
                        <IconButton
                          onClick={() => togglePause(c)}
                          icon={c.status === "ACTIVE" ? "pause" : "resume"}
                          label={c.status === "ACTIVE" ? "Pausa" : "Riattiva"}
                        />
                      )}
                      {c.status === "ARCHIVED" ? (
                        <IconButton onClick={() => unarchive(c)} icon="unarchive" label="Riattiva" />
                      ) : (
                        <IconButton onClick={() => archive(c)} icon="archive" label="Archivia" tone="danger" />
                      )}
                    </ActionsRow>
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
