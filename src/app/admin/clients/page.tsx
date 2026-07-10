"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { btnDanger, btnNeutral, card, checkbox, input, pageSubtitle, pageTitle, tableHeadBg, tableWrap, td, th, trBorder } from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  _count: { bookings: number };
}

export default function AdminClientsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

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
    return clients.filter((c) => {
      if (!showArchived && c.status === "ARCHIVED") return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [clients, search, showArchived]);

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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome o email..."
          className={`${input} sm:max-w-xs`}
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
      </div>

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
              <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <Link href={`/admin/clients/${c.id}`} className={`flex-1 text-center ${btnNeutral}`}>
                  Dettagli
                </Link>
                {c.status !== "ARCHIVED" && (
                  <button onClick={() => togglePause(c)} className={`flex-1 ${btnNeutral}`}>
                    {c.status === "ACTIVE" ? "Pausa" : "Riattiva"}
                  </button>
                )}
                {c.status === "ARCHIVED" ? (
                  <button onClick={() => unarchive(c)} className={`flex-1 ${btnNeutral}`}>
                    Riattiva
                  </button>
                ) : (
                  <button onClick={() => archive(c)} className={`flex-1 ${btnDanger}`}>
                    Archivia
                  </button>
                )}
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
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/clients/${c.id}`} className={btnNeutral}>
                        Dettagli
                      </Link>
                      {c.status !== "ARCHIVED" && (
                        <button onClick={() => togglePause(c)} className={btnNeutral}>
                          {c.status === "ACTIVE" ? "Pausa" : "Riattiva"}
                        </button>
                      )}
                      {c.status === "ARCHIVED" ? (
                        <button onClick={() => unarchive(c)} className={btnNeutral}>
                          Riattiva
                        </button>
                      ) : (
                        <button onClick={() => archive(c)} className={btnDanger}>
                          Archivia
                        </button>
                      )}
                    </div>
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
