"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { btnNeutral, pageSubtitle, pageTitle, tableHeadBg, tableWrap, td, th, trBorder } from "@/lib/ui";

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
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    load();
  }

  return (
    <div>
      <h1 className={pageTitle}>Anagrafica clienti</h1>
      <p className={pageSubtitle}>
        Gap custom rispetto a Koalendar: qui gestiamo stato attivo/in pausa e dati aggiuntivi non presenti nella
        sezione Contatti nativa.
      </p>

      <div className={tableWrap}>
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
                <td className={`${td} font-medium text-neutral-900 dark:text-white`}>
                  <Link href={`/admin/clients/${c.id}`} className="hover:text-yellow-400 hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td className={td}>{c.email}</td>
                <td className={td}>{c.phone ?? "-"}</td>
                <td className={td}>{c._count.bookings}</td>
                <td className={td}>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </td>
                <td className={td}>
                  <div className="flex gap-2">
                    <Link href={`/admin/clients/${c.id}`} className={btnNeutral}>
                      Dettagli
                    </Link>
                    <button onClick={() => toggleStatus(c)} className={btnNeutral}>
                      {c.status === "ACTIVE" ? "Metti in pausa" : "Riattiva"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nessun cliente registrato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
