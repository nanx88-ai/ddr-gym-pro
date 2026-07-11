"use client";

import { th } from "@/lib/ui";

export type SortDir = "asc" | "desc";

/**
 * Header di colonna cliccabile per ordinare una tabella: primo click ordina
 * crescente, un secondo click sulla stessa colonna inverte a decrescente.
 * Sostituisce il controllo "crescente/decrescente" separato nella barra
 * filtri, coerente col comportamento standard di fogli di calcolo/tabelle.
 */
export function SortableTh<K extends string>({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: K;
  active: boolean;
  dir: SortDir;
  onSort: (key: K) => void;
  className?: string;
}) {
  return (
    <th className={`${th} whitespace-nowrap ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        {label}
        <span className={`text-[10px] ${active ? "text-yellow-600 dark:text-yellow-400" : "opacity-30"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
