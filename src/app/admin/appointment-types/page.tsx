"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  btnNeutral,
  btnPrimary,
  card,
  input,
  label,
  pageSubtitle,
  pageTitle,
  tableWrap,
  td,
  th,
  trBorder,
} from "@/lib/ui";
import { useToast } from "@/components/Toast";
import { ActionsMenu } from "@/components/IconAction";
import { useConfirm } from "@/components/ConfirmDialog";
import { Checkbox } from "@/components/Checkbox";
import { StatusDot } from "@/components/StatusDot";
import { SortableTh, type SortDir } from "@/components/SortableTh";
import { WeeklyScheduleEditor } from "@/components/WeeklyScheduleEditor";

const VAT_NATURES = [
  { value: "", label: "Nessuna (IVA ordinaria)" },
  { value: "N1", label: "N1 - Escluse ex art.15" },
  { value: "N2", label: "N2 - Non soggette" },
  { value: "N3", label: "N3 - Non imponibili" },
  { value: "N4", label: "N4 - Esenti" },
  { value: "N5", label: "N5 - Regime del margine" },
  { value: "N6", label: "N6 - Inversione contabile" },
  { value: "N7", label: "N7 - IVA assolta in altro stato UE" },
];

type PriceUnit = "PER_SESSION" | "PACKAGE";
type BookingKind = "ONE_TIME" | "SUBSCRIPTION";

interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  capacity: number;
  requiresApproval: boolean;
  active: boolean;
  subtitle: string | null;
  quantity: string | null;
  description: string | null;
  unitPrice: number;
  priceUnit: PriceUnit;
  vatRate: number;
  vatNature: string | null;
  showInServiceList: boolean;
  showInTariffs: boolean;
  bookingKind: BookingKind;
}

interface FormState {
  name: string;
  durationMinutes: number;
  capacity: number;
  requiresApproval: boolean;
  subtitle: string;
  quantity: string;
  description: string;
  unitPrice: number;
  priceUnit: PriceUnit;
  vatRate: number;
  vatNature: string;
  showInServiceList: boolean;
  showInTariffs: boolean;
  bookingKind: BookingKind;
}

const EMPTY_FORM: FormState = {
  name: "",
  durationMinutes: 60,
  capacity: 6,
  requiresApproval: true,
  subtitle: "",
  quantity: "",
  description: "",
  unitPrice: 0,
  priceUnit: "PER_SESSION",
  vatRate: 22,
  vatNature: "",
  showInServiceList: true,
  showInTariffs: true,
  bookingKind: "ONE_TIME",
};

function toForm(t: AppointmentType): FormState {
  return {
    name: t.name,
    durationMinutes: t.durationMinutes,
    capacity: t.capacity,
    requiresApproval: t.requiresApproval,
    subtitle: t.subtitle ?? "",
    quantity: t.quantity ?? "",
    description: t.description ?? "",
    unitPrice: t.unitPrice,
    priceUnit: t.priceUnit,
    vatRate: t.vatRate,
    vatNature: t.vatNature ?? "",
    showInServiceList: t.showInServiceList,
    showInTariffs: t.showInTariffs,
    bookingKind: t.bookingKind,
  };
}

export default function AdminAppointmentTypesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = editor chiuso; "new" = creazione; altrimenti id del servizio in modifica.
  const [editingId, setEditingId] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [sortBy, setSortBy] = useState<"name" | "duration" | "capacity" | "price">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: "name" | "duration" | "capacity" | "price") {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortedTypes = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...types].sort((a, b) => {
      if (sortBy === "duration") return dir * (a.durationMinutes - b.durationMinutes);
      if (sortBy === "capacity") return dir * (a.capacity - b.capacity);
      if (sortBy === "price") return dir * (a.unitPrice - b.unitPrice);
      return dir * a.name.localeCompare(b.name);
    });
  }, [types, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/appointment-types?all=1");
    const json = await res.json();
    setTypes(json.appointmentTypes ?? []);
    setLoading(false);
    return json.appointmentTypes ?? [];
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function openEdit(t: AppointmentType) {
    setForm(toForm(t));
    setEditingId(t.id);
  }

  function closeEditor() {
    setEditingId(null);
  }

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      durationMinutes: form.durationMinutes,
      capacity: form.capacity,
      requiresApproval: form.requiresApproval,
      subtitle: form.subtitle.trim() || null,
      quantity: form.priceUnit === "PACKAGE" ? form.quantity.trim() || null : null,
      description: form.description.trim() || null,
      unitPrice: form.unitPrice,
      priceUnit: form.priceUnit,
      vatRate: form.vatRate,
      vatNature: form.vatNature || null,
      showInServiceList: form.showInServiceList,
      showInTariffs: form.showInTariffs,
      bookingKind: form.bookingKind,
    };

    const isNew = editingId === "new";
    const res = await fetch(
      isNew ? "/api/admin/appointment-types" : `/api/admin/appointment-types/${editingId}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante il salvataggio.");
      return;
    }
    const json = await res.json();
    const updated: AppointmentType[] = await load();
    toast.success(isNew ? "Servizio creato." : "Servizio aggiornato.");
    if (isNew) {
      // Resta nell'editor (ora in modalita' modifica) cosi' si possono
      // impostare subito gli orari settimanali, senza dover ricercare la riga.
      const created = json.appointmentType;
      const fresh = updated.find((t) => t.id === created.id) ?? created;
      setForm(toForm(fresh));
      setEditingId(created.id);
    }
  }

  async function toggleActive(t: AppointmentType) {
    await fetch(`/api/admin/appointment-types/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    toast.success(t.active ? "Servizio disattivato." : "Servizio riattivato.");
    load();
  }

  async function remove(t: AppointmentType) {
    if (
      !(await confirm(
        `Eliminare definitivamente "${t.name}"? L'operazione non e' reversibile.`,
      ))
    )
      return;
    const res = await fetch(`/api/admin/appointment-types/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Impossibile eliminare il servizio.");
      return;
    }
    toast.success("Servizio eliminato.");
    if (editingId === t.id) closeEditor();
    load();
  }

  function typeActions(t: AppointmentType) {
    return [
      { key: "edit", icon: "edit" as const, label: "Modifica", onClick: () => openEdit(t) },
      { key: "calendar", icon: "calendar" as const, label: "Calendario prenotazioni", onClick: () => router.push(`/admin/calendar?appointmentTypeId=${t.id}`) },
      {
        key: "toggle",
        icon: t.active ? ("pause" as const) : ("resume" as const),
        label: t.active ? "Disattiva" : "Riattiva",
        onClick: () => toggleActive(t),
      },
      { key: "delete", icon: "delete" as const, label: "Elimina", tone: "danger" as const, onClick: () => remove(t) },
    ];
  }

  const isNew = editingId === "new";
  const editorOpen = editingId !== null;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Servizi</h1>
          <p className={pageSubtitle}>
            Ogni servizio riunisce dati tecnici (durata, capienza, approvazione,
            orari), prezzo/IVA e vetrina pubblica in un unico editor.
          </p>
        </div>
        {!editorOpen && (
          <button type="button" onClick={openCreate} className={`${btnPrimary} shrink-0 whitespace-nowrap`}>
            + Aggiungi servizio
          </button>
        )}
      </div>

      {editorOpen && (
        <form onSubmit={handleSubmit} className={`${card} mt-6 mb-6 p-4`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {isNew ? "Nuovo servizio" : `Modifica: ${form.name}`}
            </h2>
            <button type="button" onClick={closeEditor} className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
              Chiudi
            </button>
          </div>

          {error && (
            <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className={label}>Nome</span>
              <input
                required
                value={form.name}
                onChange={(e) => patchForm("name", e.target.value)}
                placeholder="es. Personal Trainer Marco"
                className={input}
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={label}>Durata slot (min)</span>
              <input
                required
                type="number"
                min={5}
                max={480}
                value={form.durationMinutes}
                onChange={(e) => patchForm("durationMinutes", Number(e.target.value))}
                className={input}
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={label}>Capienza predefinita</span>
              <input
                required
                type="number"
                min={1}
                max={500}
                value={form.capacity}
                onChange={(e) => patchForm("capacity", Number(e.target.value))}
                className={input}
              />
            </label>

            <label className="flex items-center gap-2 py-2 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2">
              <Checkbox checked={form.requiresApproval} onChange={(e) => patchForm("requiresApproval", e.target.checked)} />
              Richiede approvazione
            </label>

            <label className="block sm:col-span-2">
              <span className={label}>Tipo prenotazione</span>
              <select
                value={form.bookingKind}
                onChange={(e) => patchForm("bookingKind", e.target.value as BookingKind)}
                className={input}
              >
                <option value="ONE_TIME">Ingresso singolo</option>
                <option value="SUBSCRIPTION">Abbonamento</option>
              </select>
            </label>
            {form.bookingKind === "SUBSCRIPTION" && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:col-span-4">
                I servizi ad abbonamento non si prenotano data per data dal wizard &quot;Nuova prenotazione&quot;: il wizard rimanda
                direttamente alla sezione Abbonamenti.
              </p>
            )}

            <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800 sm:col-span-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Prezzo e vetrina
              </h3>
            </div>

            <label className="block sm:col-span-1">
              <span className={label}>Prezzo &euro;</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.unitPrice}
                onChange={(e) => patchForm("unitPrice", Number(e.target.value))}
                className={input}
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={label}>Il prezzo e&apos;...</span>
              <select
                value={form.priceUnit}
                onChange={(e) => patchForm("priceUnit", e.target.value as PriceUnit)}
                className={input}
              >
                <option value="PER_SESSION">A seduta</option>
                <option value="PACKAGE">A pacchetto</option>
              </select>
            </label>
            {form.priceUnit === "PACKAGE" && (
              <label className="block sm:col-span-2">
                <span className={label}>Quantita&apos; pacchetto</span>
                <input
                  value={form.quantity}
                  onChange={(e) => patchForm("quantity", e.target.value)}
                  placeholder="es. 10 ingressi"
                  className={input}
                />
              </label>
            )}
            <label className="block sm:col-span-2">
              <span className={label}>Sottotitolo (facoltativo)</span>
              <input
                value={form.subtitle}
                onChange={(e) => patchForm("subtitle", e.target.value)}
                placeholder="es. Accesso libero in sala pesi"
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Descrizione (facoltativa)</span>
              <input
                value={form.description}
                onChange={(e) => patchForm("description", e.target.value)}
                className={input}
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={label}>IVA %</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.vatRate}
                onChange={(e) => patchForm("vatRate", Number(e.target.value))}
                className={input}
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={label}>Natura esenzione</span>
              <select value={form.vatNature} onChange={(e) => patchForm("vatNature", e.target.value)} className={input}>
                {VAT_NATURES.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2 sm:col-span-4 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <Checkbox
                  checked={form.showInServiceList}
                  onChange={(e) => patchForm("showInServiceList", e.target.checked)}
                />
                Mostra nell&apos;elenco servizi prenotabili
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <Checkbox checked={form.showInTariffs} onChange={(e) => patchForm("showInTariffs", e.target.checked)} />
                Mostra in &quot;Guarda le tariffe&quot;
              </label>
            </div>

            <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800 sm:col-span-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Orari settimanali
              </h3>
              {isNew ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Salva il servizio per impostare gli orari: il pannello comparira&apos; qui sotto, senza uscire da questa pagina.
                </p>
              ) : (
                <WeeklyScheduleEditor appointmentTypeId={editingId as string} />
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <button type="button" onClick={closeEditor} className={btnNeutral}>
              {isNew ? "Annulla" : "Chiudi"}
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Salvataggio..." : isNew ? "Crea servizio" : "Salva modifiche"}
            </button>
          </div>
        </form>
      )}

      {!loading && types.length === 0 && !editorOpen && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          Nessun servizio configurato.
        </p>
      )}

      {/* Mobile: schede, sola lettura + azioni */}
      {types.length > 0 && (
        <div className="mt-6 space-y-3 sm:hidden">
          {sortedTypes.map((t) => (
            <div key={t.id} className={`${card} p-4`}>
              <div className="flex items-center gap-2">
                <StatusDot status={t.active ? "ACTIVE" : "INACTIVE"} label={t.active ? "Attivo" : "Disattivato"} />
                <span className="flex-1 truncate font-medium text-neutral-900 dark:text-white">{t.name}</span>
                <span className="shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  {formatCurrency(t.unitPrice)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                <span>{t.durationMinutes} min</span>
                <span>Capienza {t.capacity}</span>
                {t.quantity && <span>{t.quantity}</span>}
                {t.bookingKind === "SUBSCRIPTION" && (
                  <span className="border border-yellow-500 px-1.5 text-xs font-semibold text-yellow-600 dark:border-yellow-400 dark:text-yellow-400">
                    Abbonamento
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckMark ok={t.showInServiceList} /> Prenotabile
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckMark ok={t.showInTariffs} /> Tariffario
                </span>
              </div>
              <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <ActionsMenu actions={typeActions(t)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella, sola lettura + azioni */}
      {types.length > 0 && (
        <div className={`mt-6 hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <SortableTh label="Nome" sortKey="name" active={sortBy === "name"} dir={sortDir} onSort={handleSort} className="w-full" />
                <SortableTh label="Durata" sortKey="duration" active={sortBy === "duration"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Capienza" sortKey="capacity" active={sortBy === "capacity"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Prezzo" sortKey="price" active={sortBy === "price"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Quantita&apos;</th>
                <th className={`${th} whitespace-nowrap text-center`}>Prenotabile</th>
                <th className={`${th} whitespace-nowrap text-center`}>Tariffario</th>
                <th className={`${th} whitespace-nowrap`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map((t) => (
                <tr key={t.id} className={trBorder}>
                  <td className={`${td} font-medium text-neutral-900 dark:text-white`}>
                    <div className="flex items-center gap-2">
                      <StatusDot status={t.active ? "ACTIVE" : "INACTIVE"} label={t.active ? "Attivo" : "Disattivato"} />
                      {t.name}
                      {t.bookingKind === "SUBSCRIPTION" && (
                        <span className="shrink-0 border border-yellow-500 px-1.5 text-xs font-semibold text-yellow-600 dark:border-yellow-400 dark:text-yellow-400">
                          Abbonamento
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{t.durationMinutes} min</td>
                  <td className={`${td} whitespace-nowrap`}>{t.capacity}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatCurrency(t.unitPrice)}</td>
                  <td className={`${td} whitespace-nowrap text-neutral-500 dark:text-neutral-400`}>{t.quantity ?? "—"}</td>
                  <td className={`${td} text-center`}>
                    <CheckMark ok={t.showInServiceList} />
                  </td>
                  <td className={`${td} text-center`}>
                    <CheckMark ok={t.showInTariffs} />
                  </td>
                  <td className={td}>
                    <div className="flex justify-end">
                      <ActionsMenu actions={typeActions(t)} />
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

/** Spunta verde / croce rossa per le due colonne booleane di vetrina (Prenotabile, Tariffario). */
function CheckMark({ ok }: { ok: boolean }) {
  return ok ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mx-auto h-4 w-4 text-green-600 dark:text-green-500" aria-label="Si'">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mx-auto h-4 w-4 text-red-500 dark:text-red-500" aria-label="No">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
