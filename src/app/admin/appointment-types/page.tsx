"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  btnPositive,
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

interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  capacity: number;
  requiresApproval: boolean;
  active: boolean;
}

export default function AdminAppointmentTypesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [capacity, setCapacity] = useState(6);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "duration" | "capacity">("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: "name" | "duration" | "capacity") {
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
      return dir * a.name.localeCompare(b.name);
    });
  }, [types, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/appointment-types?all=1");
    const json = await res.json();
    setTypes(json.appointmentTypes ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/appointment-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        durationMinutes,
        capacity,
        requiresApproval,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante la creazione.");
      return;
    }
    setName("");
    setDurationMinutes(60);
    setCapacity(6);
    setRequiresApproval(true);
    toast.success("Calendario creato.");
    load();
  }

  async function updateField(id: string, patch: Partial<AppointmentType>) {
    await fetch(`/api/admin/appointment-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (patch.active !== undefined)
      toast.success(
        patch.active ? "Calendario riattivato." : "Calendario disattivato.",
      );
    load();
  }

  async function remove(t: AppointmentType) {
    if (
      !(await confirm(
        `Eliminare definitivamente"${t.name}"? L'operazione non e'reversibile.`,
      ))
    )
      return;
    const res = await fetch(`/api/admin/appointment-types/${t.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Impossibile eliminare il calendario.");
      return;
    }
    toast.success("Calendario eliminato.");
    load();
  }

  function typeActions(t: AppointmentType) {
    return [
      { key: "schedule", icon: "schedule" as const, label: "Orario", onClick: () => router.push(`/admin/schedule?appointmentTypeId=${t.id}`) },
      { key: "calendar", icon: "calendar" as const, label: "Calendario", onClick: () => router.push(`/admin/calendar?appointmentTypeId=${t.id}`) },
      {
        key: "toggle",
        icon: t.active ? ("pause" as const) : ("resume" as const),
        label: t.active ? "Disattiva" : "Riattiva",
        onClick: () => updateField(t.id, { active: !t.active }),
      },
      { key: "delete", icon: "delete" as const, label: "Elimina", tone: "danger" as const, onClick: () => remove(t) },
    ];
  }

  return (
    <div>
      <h1 className={pageTitle}>Calendari e servizi</h1>
      <p className={pageSubtitle}>
        Ogni calendario ha una propria durata slot, capienza predefinita, orario
        settimanale e pausa pranzo. Usali per gestire collaboratori diversi o
        servizi diversi in parallelo.
      </p>

      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
          Nuovo calendario
        </h2>
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end"
        >
          <label className="block sm:w-56">
            <span className={label}>Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Personal Trainer Marco"
              className={input}
            />
          </label>
          <label className="block sm:w-40">
            <span className={label}>Durata slot (min)</span>
            <input
              required
              type="number"
              min={5}
              max={480}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="block sm:w-40">
            <span className={label}>Capienza predefinita</span>
            <input
              required
              type="number"
              min={1}
              max={500}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 py-2 text-sm text-neutral-700 dark:text-neutral-300">
            <Checkbox checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
            Richiede approvazione
          </label>
          <button
            type="submit"
            disabled={creating}
            className={`${btnPositive} w-full sm:w-auto`}
          >
            {creating ? "Creazione..." : "Crea calendario"}
          </button>
        </form>
      </div>

      {!loading && types.length === 0 && (
        <p
          className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}
        >
          Nessun calendario configurato.
        </p>
      )}

      {/* Mobile: schede */}
      {types.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sortedTypes.map((t) => (
            <div key={t.id} className={`${card} p-4`}>
              <div className="flex items-center gap-2">
                <StatusDot status={t.active ? "ACTIVE" : "INACTIVE"} label={t.active ? "Attivo" : "Disattivato"} />
                <span className="font-medium text-neutral-900 dark:text-white">
                  {t.name}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={label}>Durata slot (min)</span>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    defaultValue={t.durationMinutes}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== t.durationMinutes)
                        updateField(t.id, { durationMinutes: v });
                    }}
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={label}>Capienza</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    defaultValue={t.capacity}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== t.capacity) updateField(t.id, { capacity: v });
                    }}
                    className={input}
                  />
                </label>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <Checkbox
                  checked={t.requiresApproval}
                  onChange={(e) => updateField(t.id, { requiresApproval: e.target.checked })}
                />
                Richiede approvazione
              </label>

              <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <div className="flex justify-end">
                  <ActionsMenu actions={typeActions(t)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {types.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <SortableTh label="Nome" sortKey="name" active={sortBy === "name"} dir={sortDir} onSort={handleSort} className="w-full" />
                <SortableTh label="Durata" sortKey="duration" active={sortBy === "duration"} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Capienza" sortKey="capacity" active={sortBy === "capacity"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Approvazione</th>
                <th className={`${th} whitespace-nowrap`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map((t) => (
                <tr key={t.id} className={trBorder}>
                  <td
                    className={`${td} font-medium text-neutral-900 dark:text-white`}
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={t.active ? "ACTIVE" : "INACTIVE"} label={t.active ? "Attivo" : "Disattivato"} />
                      {t.name}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <input
                        type="number"
                        min={5}
                        max={480}
                        defaultValue={t.durationMinutes}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== t.durationMinutes)
                            updateField(t.id, { durationMinutes: v });
                        }}
                        className={`${input} w-20 shrink-0`}
                      />
                      <span className="shrink-0 text-neutral-500">min</span>
                    </div>
                  </td>
                  <td className={td}>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={t.capacity}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== t.capacity)
                          updateField(t.id, { capacity: v });
                      }}
                      className={`${input} w-14`}
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <Checkbox
                      checked={t.requiresApproval}
                      onChange={(e) => updateField(t.id, { requiresApproval: e.target.checked })}
                    />
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
