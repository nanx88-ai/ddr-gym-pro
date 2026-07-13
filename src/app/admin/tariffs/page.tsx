"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionsMenu } from "@/components/IconAction";
import { StatusDot } from "@/components/StatusDot";
import { SortableTh, type SortDir } from "@/components/SortableTh";

interface Tariff {
  id: string;
  title: string;
  subtitle: string | null;
  quantity: string | null;
  price: number;
  active: boolean;
  sortOrder: number;
}

export default function AdminTariffsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(50);
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "price">("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: "title" | "price") {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortedItems = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortBy === "price") return dir * (a.price - b.price);
      return dir * a.title.localeCompare(b.title);
    });
  }, [items, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/tariffs");
    const json = await res.json();
    setItems(json.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/tariffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        subtitle: subtitle.trim() || null,
        quantity: quantity.trim() || null,
        price,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante la creazione.");
      return;
    }
    setTitle("");
    setSubtitle("");
    setQuantity("");
    toast.success("Tariffa creata.");
    load();
  }

  async function updateField(item: Tariff, patch: Partial<Tariff>) {
    await fetch(`/api/admin/tariffs/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    toast.success("Tariffa aggiornata.");
    load();
  }

  async function toggleActive(item: Tariff) {
    await fetch(`/api/admin/tariffs/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    toast.success(item.active ? "Tariffa messa in pausa." : "Tariffa riattivata.");
    load();
  }

  async function remove(item: Tariff) {
    if (!(await confirm(`Eliminare definitivamente "${item.title}"? L'operazione non e' reversibile.`))) return;
    const res = await fetch(`/api/admin/tariffs/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Impossibile eliminare la tariffa.");
      return;
    }
    toast.success("Tariffa eliminata.");
    load();
  }

  function tariffActions(item: Tariff) {
    return [
      {
        key: "toggle",
        icon: item.active ? ("pause" as const) : ("resume" as const),
        label: item.active ? "Metti in pausa" : "Riattiva",
        onClick: () => toggleActive(item),
      },
      { key: "delete", icon: "delete" as const, label: "Elimina", tone: "danger" as const, onClick: () => remove(item) },
    ];
  }

  return (
    <div>
      <h1 className={pageTitle}>Tariffe</h1>
      <p className={pageSubtitle}>
        Il tariffario pubblico: quello che i clienti vedono con &quot;Guarda le
        tariffe&quot; sulla pagina di prenotazione. Le voci in pausa restano qui
        ma spariscono dal sito.
      </p>

      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Nuova tariffa</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label className="block sm:w-56">
            <span className={label}>Titolo</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Abbonamento mensile"
              className={input}
            />
          </label>
          <label className="block sm:w-64">
            <span className={label}>Sottotitolo (facoltativo)</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="es. Accesso libero in sala pesi"
              className={input}
            />
          </label>
          <label className="block sm:w-40">
            <span className={label}>Quantita&apos; (facoltativa)</span>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="es. 10 ingressi"
              className={input}
            />
          </label>
          <label className="block sm:w-32">
            <span className={label}>Prezzo &euro;</span>
            <input
              required
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className={input}
            />
          </label>
          <button type="submit" disabled={creating} className={`${btnPositive} w-full sm:w-auto`}>
            {creating ? "Creazione..." : "Aggiungi"}
          </button>
        </form>
      </div>

      {!loading && items.length === 0 && (
        <p className={`${card} px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
          Nessuna tariffa. Aggiungi la prima qui sopra.
        </p>
      )}

      {/* Mobile: schede */}
      {items.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sortedItems.map((item) => (
            <div key={item.id} className={`${card} p-4`}>
              <div className="flex items-center gap-2">
                <StatusDot status={item.active ? "ACTIVE" : "INACTIVE"} label={item.active ? "Attiva" : "In pausa"} />
                <input
                  defaultValue={item.title}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== item.title) updateField(item, { title: v });
                  }}
                  className={`${input} flex-1 font-medium`}
                />
              </div>
              <label className="mt-2 block">
                <span className={label}>Sottotitolo</span>
                <input
                  defaultValue={item.subtitle ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (item.subtitle ?? "")) updateField(item, { subtitle: v || null });
                  }}
                  className={input}
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={label}>Quantita&apos;</span>
                  <input
                    defaultValue={item.quantity ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (item.quantity ?? "")) updateField(item, { quantity: v || null });
                    }}
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={label}>Prezzo &euro;</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={item.price}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== item.price) updateField(item, { price: v });
                    }}
                    className={input}
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <ActionsMenu actions={tariffActions(item)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop/tablet: tabella */}
      {items.length > 0 && (
        <div className={`hidden sm:block ${tableWrap}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <tr>
                <SortableTh label="Titolo" sortKey="title" active={sortBy === "title"} dir={sortDir} onSort={handleSort} />
                <th className={th}>Sottotitolo</th>
                <th className={`${th} whitespace-nowrap`}>Quantita&apos;</th>
                <SortableTh label="Prezzo" sortKey="price" active={sortBy === "price"} dir={sortDir} onSort={handleSort} />
                <th className={`${th} whitespace-nowrap`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id} className={trBorder}>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <StatusDot status={item.active ? "ACTIVE" : "INACTIVE"} label={item.active ? "Attiva" : "In pausa"} />
                      <input
                        defaultValue={item.title}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== item.title) updateField(item, { title: v });
                        }}
                        className={`${input} w-56 font-medium`}
                      />
                    </div>
                  </td>
                  <td className={td}>
                    <input
                      defaultValue={item.subtitle ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (item.subtitle ?? "")) updateField(item, { subtitle: v || null });
                      }}
                      className={`${input} w-full min-w-40`}
                    />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <input
                      defaultValue={item.quantity ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (item.quantity ?? "")) updateField(item, { quantity: v || null });
                      }}
                      className={`${input} w-32 shrink-0`}
                    />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-neutral-500">&euro;</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={item.price}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== item.price) updateField(item, { price: v });
                        }}
                        className={`${input} w-24 shrink-0`}
                      />
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="flex justify-end">
                      <ActionsMenu actions={tariffActions(item)} />
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
