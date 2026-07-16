"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnNeutral, btnPrimary, card, errorBox, input, pageSubtitle, pageTitle, tableHeadBg, tableWrap, td, th, trBorder } from "@/lib/ui";
import { Checkbox } from "@/components/Checkbox";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionsMenu } from "@/components/IconAction";
import { StatusDot } from "@/components/StatusDot";
import { SortableTh, type SortDir } from "@/components/SortableTh";
import { SortDirToggle } from "@/components/SortDirToggle";
import { NewClientFields, emptyNewClient, newClientIsValid } from "@/components/NewClientFields";
import { SkeletonCards } from "@/components/Skeleton";

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

type SortBy = "name" | "email" | "phone" | "bookings";

export default function AdminClientsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [incompleteFiscal, setIncompleteFiscal] = useState(false);
  const [hasUpcomingReminder, setHasUpcomingReminder] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortActive, setSortActive] = useState(false);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [newClient, setNewClient] = useState(emptyNewClient());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      if (c.status === "ARCHIVED") return false;
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

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "bookings") return dir * (a._count.bookings - b._count.bookings);
      if (sortBy === "email") return dir * a.email.localeCompare(b.email);
      if (sortBy === "phone") return dir * (a.phone ?? "").localeCompare(b.phone ?? "");
      return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [clients, search, appointmentTypeId, inactiveDays, incompleteFiscal, hasUpcomingReminder, sortBy, sortDir]);

  const archivedClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => c.status === "ARCHIVED")
      .filter((c) => !q || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [clients, search]);

  const activeFilterCount =
    (appointmentTypeId ? 1 : 0) +
    (inactiveDays ? 1 : 0) +
    (incompleteFiscal ? 1 : 0) +
    (hasUpcomingReminder ? 1 : 0);

  function resetFilters() {
    setAppointmentTypeId("");
    setInactiveDays("");
    setIncompleteFiscal(false);
    setHasUpcomingReminder(false);
  }

  function handleSort(key: SortBy) {
    setSortActive(true);
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

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

  async function remove(client: Client) {
    if (
      !(await confirm({
        message: `Eliminare definitivamente ${client.firstName} ${client.lastName}? L'operazione non e' reversibile.`,
        confirmLabel: "Elimina",
      }))
    )
      return;
    const res = await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Impossibile eliminare il cliente.");
      return;
    }
    toast.success("Cliente eliminato.");
    load();
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!newClientIsValid(newClient)) {
      setCreateError("Nome, cognome ed email sono obbligatori.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        email: newClient.email,
        phone: newClient.phone || undefined,
        dateOfBirth: newClient.dateOfBirth || undefined,
        sex: newClient.sex || undefined,
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setCreateError(json.error ?? "Errore durante la creazione.");
      return;
    }
    toast.success("Cliente creato.");
    router.push(`/admin/clients/${json.client.id}`);
  }

  function clientActions(c: Client) {
    return [
      {
        key: "open",
        icon: "chevronRight" as const,
        label: "Apri",
        onClick: () => router.push(`/admin/clients/${c.id}`),
      },
      {
        key: "pause",
        icon: c.status === "ACTIVE" ? ("pause" as const) : ("resume" as const),
        label: c.status === "ACTIVE" ? "Pausa" : "Riattiva",
        onClick: () => togglePause(c),
        hidden: c.status === "ARCHIVED",
      },
      {
        key: "unarchive",
        icon: "unarchive" as const,
        label: "Riattiva",
        onClick: () => unarchive(c),
        hidden: c.status !== "ARCHIVED",
      },
      {
        key: "archive",
        icon: "archive" as const,
        label: "Archivia",
        onClick: () => archive(c),
        hidden: c.status === "ARCHIVED",
      },
      {
        key: "delete",
        icon: "delete" as const,
        label: "Elimina",
        tone: "danger" as const,
        onClick: () => remove(c),
      },
    ];
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Anagrafica clienti</h1>
          <p className={pageSubtitle}>
            Gap custom rispetto a Koalendar: qui gestiamo stato attivo/in pausa/archiviato e dati aggiuntivi non presenti
            nella sezione Contatti nativa.
          </p>
        </div>
        {!creatorOpen && (
          <button
            type="button"
            onClick={() => {
              setNewClient(emptyNewClient());
              setCreateError(null);
              setCreatorOpen(true);
            }}
            className={`${btnPrimary} shrink-0 whitespace-nowrap`}
          >
            + Nuovo cliente
          </button>
        )}
      </div>

      {creatorOpen && (
        <form onSubmit={handleCreateClient} className={`${card} mt-6 mb-6 p-4`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Nuovo cliente</h2>
            <button
              type="button"
              onClick={() => setCreatorOpen(false)}
              className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Chiudi
            </button>
          </div>

          {createError && <div className={`mb-4 ${errorBox}`}>{createError}</div>}

          <NewClientFields value={newClient} onChange={setNewClient} />

          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <button type="button" onClick={() => setCreatorOpen(false)} className={btnNeutral}>
              Annulla
            </button>
            <button type="submit" disabled={creating} className={btnPrimary}>
              {creating ? "Creazione..." : "Crea cliente"}
            </button>
          </div>
        </form>
      )}

      {!creatorOpen && (
      <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome o email..."
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
          <label
            className={`${input} w-full flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <Checkbox checked={incompleteFiscal} onChange={(e) => setIncompleteFiscal(e.target.checked)} />
            Dati fiscali incompleti
          </label>
          <label
            className={`${input} w-full flex items-center gap-2 border border-neutral-300 bg-neutral-100 font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200`}
          >
            <Checkbox checked={hasUpcomingReminder} onChange={(e) => setHasUpcomingReminder(e.target.checked)} />
            Con scadenze in arrivo
          </label>

          {/* Da mobile non ci sono intestazioni di colonna cliccabili: stesso
              ordinamento delle colonne desktop via select + bottone direzione. */}
          <div className="flex gap-2 sm:hidden">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className={`${input} w-full flex-1`}
            >
              <option value="name">Ordina per nome</option>
              <option value="email">Ordina per email</option>
              <option value="phone">Ordina per telefono</option>
              <option value="bookings">Ordina per prenotazioni</option>
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

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-500 hover:border-red-400 hover:text-red-500 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-red-500 dark:hover:text-red-400"
            >
              Reset filtri
            </button>
          )}
        </div>
      )}

      {loading && <SkeletonCards />}

      {!loading && visibleClients.length === 0 && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          Nessun cliente trovato.
        </p>
      )}

      {/* Mobile: schede - niente click sull'intera scheda (rischio di apertura
          accidentale durante lo scroll), apertura solo via bottone dedicato. */}
      {visibleClients.length > 0 && (
        <div className="space-y-2 sm:hidden">
          {visibleClients.map((c) => (
            <div key={c.id} className={`${card} space-y-1 px-4 py-3.5`}>
              <div className="flex items-center gap-2">
                <StatusDot status={c.status} />
                <span className="flex-1 truncate text-base font-bold text-neutral-900 dark:text-white">
                  {c.firstName} {c.lastName}
                </span>
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">{c.email}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-500">
                {c.phone ?? "Nessun telefono"} · {c._count.bookings} prenotazion{c._count.bookings === 1 ? "e" : "i"}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => router.push(`/admin/clients/${c.id}`)}
                  className="text-sm font-medium text-yellow-600 hover:underline dark:text-yellow-400"
                >
                  Apri
                </button>
                <ActionsMenu actions={clientActions(c)} />
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
                <SortableTh label="Nome" sortKey="name" active={sortBy === "name"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Email" sortKey="email" active={sortBy === "email"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Telefono" sortKey="phone" active={sortBy === "phone"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Prenotazioni" sortKey="bookings" active={sortBy === "bookings"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/clients/${c.id}`)}
                  className={`${trBorder} cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/40`}
                >
                  <td className={`${td} font-medium text-neutral-900 dark:text-white`}>
                    <div className="flex items-center gap-2">
                      <StatusDot status={c.status} />
                      {c.firstName} {c.lastName}
                    </div>
                  </td>
                  <td className={td}>{c.email}</td>
                  <td className={`${td} whitespace-nowrap`}>{c.phone ?? "-"}</td>
                  <td className={`${td} whitespace-nowrap`}>{c._count.bookings}</td>
                  <td className={`${td} whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <ActionsMenu actions={clientActions(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sezione separata: clienti archiviati, collassata di default cosi'
          non si mescolano con l'anagrafica attiva ma restano raggiungibili. */}
      {archivedClients.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setArchivedOpen((o) => !o)}
            className="flex min-h-11 items-center gap-1.5 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Archiviati
            <span className="flex h-4 min-w-4 items-center justify-center bg-neutral-300 px-1 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-600 dark:text-neutral-100">
              {archivedClients.length}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-3.5 w-3.5 transition-transform ${archivedOpen ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {archivedOpen && (
            <>
              {/* Mobile: schede */}
              <div className="mt-3 space-y-2 sm:hidden">
                {archivedClients.map((c) => (
                  <div key={c.id} className={`${card} space-y-1 px-4 py-3.5 opacity-75`}>
                    <span className="block truncate text-base font-bold text-neutral-900 dark:text-white">
                      {c.firstName} {c.lastName}
                    </span>
                    <div className="text-sm text-neutral-600 dark:text-neutral-300">{c.email}</div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/clients/${c.id}`)}
                        className="text-sm font-medium text-yellow-600 hover:underline dark:text-yellow-400"
                      >
                        Apri
                      </button>
                      <ActionsMenu actions={clientActions(c)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/tablet: tabella */}
              <div className={`mt-3 hidden sm:block ${tableWrap}`}>
                <table className="w-full text-sm">
                  <thead className={tableHeadBg}>
                    <tr>
                      <th className={th}>Nome</th>
                      <th className={th}>Email</th>
                      <th className={`${th} whitespace-nowrap`}>Prenotazioni</th>
                      <th className={`${th} whitespace-nowrap`}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedClients.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/admin/clients/${c.id}`)}
                        className={`${trBorder} cursor-pointer opacity-75 hover:bg-neutral-50 dark:hover:bg-neutral-900/40`}
                      >
                        <td className={`${td} font-medium text-neutral-900 dark:text-white`}>
                          {c.firstName} {c.lastName}
                        </td>
                        <td className={td}>{c.email}</td>
                        <td className={`${td} whitespace-nowrap`}>{c._count.bookings}</td>
                        <td className={`${td} whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <ActionsMenu actions={clientActions(c)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
