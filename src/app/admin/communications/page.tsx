"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import {
  btnPositive,
  btnPrimary,
  card,
  input,
  label,
  pageSubtitle,
  pageTitle,
  toggleActive,
  toggleInactive,
} from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionsMenu } from "@/components/IconAction";
import { StatusDot } from "@/components/StatusDot";
import { Checkbox } from "@/components/Checkbox";
import { RichTextEditor } from "@/components/RichTextEditor";

interface Announcement {
  id: string;
  title: string | null;
  body: string;
  active: boolean;
  updatedAt: string;
}

interface Broadcast {
  id: string;
  subject: string;
  audience: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

const AUDIENCES = [
  { value: "ACTIVE" as const, label: "Clienti attivi" },
  { value: "ALL" as const, label: "Tutti gli iscritti" },
  { value: "SELECTED" as const, label: "Selezione manuale" },
];

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Tutti gli iscritti",
  ACTIVE: "Clienti attivi",
  SELECTED: "Selezione manuale",
};

export default function AdminCommunicationsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  // --- Annunci in bacheca ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPublish, setAnnPublish] = useState(true);
  const [annSaving, setAnnSaving] = useState(false);

  // --- Email ---
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [audience, setAudience] = useState<"ALL" | "ACTIVE" | "SELECTED">("ACTIVE");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  async function load() {
    const [annRes, clientsRes, bcRes] = await Promise.all([
      fetch("/api/admin/announcements"),
      fetch("/api/admin/clients"),
      fetch("/api/admin/broadcasts"),
    ]);
    setAnnouncements((await annRes.json()).items ?? []);
    setClients((await clientsRes.json()).clients ?? []);
    setBroadcasts((await bcRes.json()).items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const recipientCount = useMemo(() => {
    if (audience === "ALL") return clients.length;
    if (audience === "ACTIVE") return clients.filter((c) => c.status === "ACTIVE").length;
    return selectedIds.size;
  }, [audience, clients, selectedIds]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q),
    );
  }, [clients, clientSearch]);

  // --- Handlers annunci ---

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setAnnSaving(true);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: annTitle.trim() || null, body: annBody.trim(), active: annPublish }),
    });
    setAnnSaving(false);
    if (!res.ok) {
      toast.error("Errore durante il salvataggio dell'annuncio.");
      return;
    }
    setAnnTitle("");
    setAnnBody("");
    toast.success(annPublish ? "Annuncio pubblicato in bacheca." : "Annuncio salvato (non pubblicato).");
    load();
  }

  async function toggleAnnouncement(a: Announcement) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    toast.success(a.active ? "Annuncio ritirato dalla bacheca." : "Annuncio pubblicato (gli altri sono stati ritirati).");
    load();
  }

  async function removeAnnouncement(a: Announcement) {
    if (!(await confirm("Eliminare definitivamente questo annuncio?"))) return;
    await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
    toast.success("Annuncio eliminato.");
    load();
  }

  function announcementActions(a: Announcement) {
    return [
      {
        key: "toggle",
        icon: a.active ? ("pause" as const) : ("resume" as const),
        label: a.active ? "Ritira dalla bacheca" : "Pubblica in bacheca",
        onClick: () => toggleAnnouncement(a),
      },
      {
        key: "delete",
        icon: "delete" as const,
        label: "Elimina",
        tone: "danger" as const,
        onClick: () => removeAnnouncement(a),
      },
    ];
  }

  // --- Handlers email ---

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // L'editor puo' restituire markup "vuoto" (es. <br> residuo dopo aver
  // cancellato tutto): il testo nudo decide se c'e' davvero un contenuto.
  const bodyIsEmpty = bodyHtml.replace(/<[^>]*>/g, "").trim().length === 0;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (bodyIsEmpty) {
      toast.error("Scrivi il corpo del messaggio.");
      return;
    }
    if (
      !(await confirm(
        `Inviare "${subject}" a ${recipientCount} destinatar${recipientCount === 1 ? "io" : "i"} (${AUDIENCE_LABELS[audience].toLowerCase()})?`,
      ))
    )
      return;

    setSending(true);
    const res = await fetch("/api/admin/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        bodyHtml,
        audience,
        clientIds: audience === "SELECTED" ? [...selectedIds] : undefined,
      }),
    });
    setSending(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "Errore durante l'invio.");
      return;
    }
    toast.success(
      `Email inviata a ${json.sent} destinatar${json.sent === 1 ? "io" : "i"}${json.failed ? ` (${json.failed} falliti)` : ""}.`,
    );
    setSubject("");
    setBodyHtml("");
    setSelectedIds(new Set());
    load();
  }

  return (
    <div>
      <h1 className={pageTitle}>Comunicazioni</h1>
      <p className={pageSubtitle}>
        Annunci in bacheca sulla pagina di prenotazione e comunicazioni email
        ai clienti.
      </p>

      {/* ============ Annuncio in bacheca ============ */}
      <div className={`${card} mb-6 p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Annuncio in bacheca</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Compare in evidenza sulla pagina pubblica di prenotazione. Al massimo
          un annuncio e&apos; pubblicato alla volta: pubblicarne uno ritira gli altri.
        </p>

        <form onSubmit={createAnnouncement} className="space-y-3">
          <label className="block sm:max-w-md">
            <span className={label}>Titolo (facoltativo)</span>
            <input
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="es. Chiusura straordinaria"
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Testo</span>
            <textarea
              required
              rows={3}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="es. Si avvisa che la palestra rimarra' chiusa nella giornata di domani."
              className={`${input} resize-y`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <Checkbox checked={annPublish} onChange={(e) => setAnnPublish(e.target.checked)} />
              <span className="text-sm text-neutral-700 dark:text-neutral-200">Pubblica subito</span>
            </label>
            <button type="submit" disabled={annSaving} className={btnPositive}>
              {annSaving ? "Salvataggio..." : annPublish ? "Pubblica" : "Salva"}
            </button>
          </div>
        </form>

        {announcements.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            {announcements.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <StatusDot
                  status={a.active ? "ACTIVE" : "INACTIVE"}
                  label={a.active ? "In bacheca" : "Non pubblicato"}
                  className="mt-1.5"
                />
                <div className="min-w-0 flex-1">
                  {a.title && <p className="text-sm font-medium text-neutral-900 dark:text-white">{a.title}</p>}
                  <p className="truncate text-sm text-neutral-600 dark:text-neutral-300">{a.body}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{formatDateTime(a.updatedAt)}</p>
                </div>
                <ActionsMenu actions={announcementActions(a)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ============ Invio email ============ */}
      <div className={`${card} mb-6 p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">Invia email</h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Ogni destinatario riceve la propria copia, senza vedere gli indirizzi
          degli altri. Richiede un&apos;integrazione SMTP attiva in Impostazioni.
        </p>

        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <span className={label}>Destinatari</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={`min-h-11 border-2 px-3 text-sm font-medium transition-colors ${
                    audience === a.value ? toggleActive : toggleInactive
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {recipientCount} destinatar{recipientCount === 1 ? "io" : "i"}
            </p>
          </div>

          {audience === "SELECTED" && (
            <div className="border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 p-2 dark:border-neutral-800">
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Cerca cliente..."
                  className={input}
                />
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {filteredClients.map((c) => (
                  <li key={c.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                      <Checkbox checked={selectedIds.has(c.id)} onChange={() => toggleSelected(c.id)} />
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
                        {c.lastName} {c.firstName}
                        <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">{c.email}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {filteredClients.length === 0 && (
                  <li className="px-3 py-3 text-sm text-neutral-500 dark:text-neutral-400">Nessun cliente trovato.</li>
                )}
              </ul>
            </div>
          )}

          <label className="block">
            <span className={label}>Oggetto</span>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="es. Nuovi orari estivi"
              className={input}
            />
          </label>

          <div>
            <span className={label}>Messaggio</span>
            <div className="mt-1">
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Scrivi la comunicazione..." />
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || recipientCount === 0}
            className={`${btnPrimary} w-full sm:w-auto`}
          >
            {sending ? "Invio in corso..." : `Invia a ${recipientCount} destinatar${recipientCount === 1 ? "io" : "i"}`}
          </button>
        </form>
      </div>

      {/* ============ Storico invii ============ */}
      {broadcasts.length > 0 && (
        <div className={`${card} p-4`}>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Storico invii</h2>
          <ul className="space-y-2">
            {broadcasts.map((b) => (
              <li key={b.id} className="flex items-start gap-2">
                <StatusDot
                  status={b.failedCount === 0 ? "SUCCESS" : b.sentCount === 0 ? "ERROR" : "PENDING"}
                  label={b.failedCount === 0 ? "Inviata" : b.sentCount === 0 ? "Fallita" : "Parziale"}
                  className="mt-1.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{b.subject}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {AUDIENCE_LABELS[b.audience] ?? b.audience} &middot; {b.sentCount} inviate
                    {b.failedCount > 0 && `, ${b.failedCount} fallite`} &middot; {formatDateTime(b.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
