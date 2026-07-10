"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import {
  btnDanger,
  btnNeutral,
  card,
  pageSubtitle,
  pageTitle,
  tableHeadBg,
  tableWrap,
  td,
  th,
  trBorder,
} from "@/lib/ui";
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

  async function toggleStatus(client: Client) {
    const nextStatus = client.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    if (
      nextStatus === "PAUSED" &&
      !(await confirm(
        `Mettere in pausa ${client.firstName} ${client.lastName}? Non potra'prenotare finche'non lo riattivi.`,
      ))
    ) {
      return;
    }
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    toast.success(
      nextStatus === "PAUSED"
        ? "Cliente messo in pausa."
        : "Cliente riattivato.",
    );
    load();
  }

  async function remove(client: Client) {
    if (
      !(await confirm(
        `Eliminare definitivamente ${client.firstName} ${client.lastName}? L'operazione non e'reversibile.`,
      ))
    ) {
      return;
    }
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Impossibile eliminare il cliente.");
      return;
    }
    toast.success("Cliente eliminato.");
    load();
  }

  return (
    <div>
      <h1 className={pageTitle}>Anagrafica clienti</h1>
      <p className={pageSubtitle}>
        Gap custom rispetto a Koalendar: qui gestiamo stato attivo/in pausa e
        dati aggiuntivi non presenti nella sezione Contatti nativa.
      </p>

      {!loading && clients.length === 0 && (
        <p
          className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}
        >
          Nessun cliente registrato.
        </p>
      )}

      {/* Mobile: schede */}
      {clients.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {clients.map((c) => (
            <div key={c.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="font-medium text-neutral-900 hover:underline dark:text-white"
                >
                  {c.firstName} {c.lastName}
                </Link>
                <span
                  className={`shrink-0 px-2 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}
                >
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {c.email}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-300">
                  {c.phone ?? "Nessun telefono"}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {c._count.bookings} prenotazion
                  {c._count.bookings === 1 ? "e" : "i"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <Link
                  href={`/admin/clients/${c.id}`}
                  className={`flex-1 text-center ${btnNeutral}`}
                >
                  Dettagli
                </Link>
                <button
                  onClick={() => toggleStatus(c)}
                  className={`flex-1 ${btnNeutral}`}
                >
                  {c.status === "ACTIVE" ? "Pausa" : "Riattiva"}
                </button>
                <button
                  onClick={() => remove(c)}
                  className={`flex-1 ${btnDanger}`}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {clients.length > 0 && (
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
              {clients.map((c) => (
                <tr key={c.id} className={trBorder}>
                  <td
                    className={`${td} font-medium text-neutral-900 dark:text-white`}
                  >
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="hover:text-yellow-400 hover:underline"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className={td}>{c.email}</td>
                  <td className={td}>{c.phone ?? "-"}</td>
                  <td className={td}>{c._count.bookings}</td>
                  <td className={td}>
                    <span
                      className={`px-2 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className={btnNeutral}
                      >
                        Dettagli
                      </Link>
                      <button
                        onClick={() => toggleStatus(c)}
                        className={btnNeutral}
                      >
                        {c.status === "ACTIVE" ? "Pausa" : "Riattiva"}
                      </button>
                      <button onClick={() => remove(c)} className={btnDanger}>
                        Elimina
                      </button>
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
