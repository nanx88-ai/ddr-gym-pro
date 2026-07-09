"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { btnDanger, btnNeutral, btnPositive, card, input, label, pageSubtitle, pageTitle, tableWrap, td, th, trBorder } from "@/lib/ui";
import { useToast } from "@/components/Toast";

interface PriceListItem {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  vatRate: number;
  vatNature: string | null;
  active: boolean;
}

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

export default function AdminPriceListPage() {
  const toast = useToast();
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState(20);
  const [vatRate, setVatRate] = useState(22);
  const [vatNature, setVatNature] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/price-list");
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
    const res = await fetch("/api/admin/price-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unitPrice, vatRate, vatNature: vatNature || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Errore durante la creazione.");
      return;
    }
    setName("");
    toast.success("Voce di listino creata.");
    load();
  }

  async function toggleActive(item: PriceListItem) {
    await fetch(`/api/admin/price-list/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    toast.success(item.active ? "Voce disattivata." : "Voce riattivata.");
    load();
  }

  async function remove(item: PriceListItem) {
    if (!window.confirm(`Eliminare definitivamente "${item.name}"? L'operazione non e' reversibile.`)) return;
    const res = await fetch(`/api/admin/price-list/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Impossibile eliminare la voce.");
      return;
    }
    toast.success("Voce eliminata.");
    load();
  }

  return (
    <div>
      <h1 className={pageTitle}>Listino</h1>
      <p className={pageSubtitle}>Voci di prezzo con aliquota IVA o natura di esenzione, usate per generare le fatture.</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={`${card} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">Nuova voce</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={label}>Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Ingresso singolo"
              className={`${input} w-56`}
            />
          </label>
          <label className="block">
            <span className={label}>Prezzo unitario (IVA esclusa)</span>
            <input
              required
              type="number"
              min={0}
              step={0.01}
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className={`${input} w-32`}
            />
          </label>
          <label className="block">
            <span className={label}>Aliquota IVA %</span>
            <input
              required
              type="number"
              min={0}
              max={100}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              className={`${input} w-24`}
            />
          </label>
          <label className="block">
            <span className={label}>Natura (se esente)</span>
            <select value={vatNature} onChange={(e) => setVatNature(e.target.value)} className={`${input} w-56`}>
              {VAT_NATURES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={creating} className={btnPositive}>
            {creating ? "Creazione..." : "Aggiungi"}
          </button>
        </form>
      </div>

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
            <tr>
              <th className={th}>Nome</th>
              <th className={th}>Prezzo</th>
              <th className={th}>IVA</th>
              <th className={th}>Stato</th>
              <th className={th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={trBorder}>
                <td className={`${td} font-medium text-neutral-900 dark:text-white`}>{item.name}</td>
                <td className={td}>{formatCurrency(item.unitPrice)}</td>
                <td className={td}>{item.vatNature ? `Esente (${item.vatNature})` : `${item.vatRate}%`}</td>
                <td className={td}>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.active ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-400"
                    }`}
                  >
                    {item.active ? "Attiva" : "Disattivata"}
                  </span>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleActive(item)} className={btnNeutral}>
                      {item.active ? "Disattiva" : "Riattiva"}
                    </button>
                    <button onClick={() => remove(item)} className={btnDanger}>
                      Elimina
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nessuna voce di listino.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
