"use client";

import { useState } from "react";
import { toggleActive, toggleInactive } from "@/lib/ui";

/**
 * Bottone a 3 stati per la direzione di ordinamento su mobile, dove le
 * intestazioni di colonna cliccabili (SortableTh) non esistono: spento
 * (ordine di default) -> A-Z -> Z-A -> spento. Lo stato "spento" lascia
 * l'ordinamento reale invariato (equivale ad ascendente), cambia solo
 * l'aspetto del bottone; il campo su cui ordinare si sceglie a parte con
 * il select "Ordina per" accanto.
 */
export function SortDirToggle({
  active,
  dir,
  onChange,
}: {
  active: boolean;
  dir: "asc" | "desc";
  onChange: (next: { active: boolean; dir: "asc" | "desc" }) => void;
}) {
  const [flip, setFlip] = useState(false);

  function handleClick() {
    setFlip(true);
    setTimeout(() => setFlip(false), 180);
    if (!active) onChange({ active: true, dir: "asc" });
    else if (dir === "asc") onChange({ active: true, dir: "desc" });
    else onChange({ active: false, dir: "asc" });
  }

  const label = active ? (dir === "asc" ? "A→Z" : "Z→A") : "A-Z";
  const title = active ? (dir === "asc" ? "Crescente (A-Z) - premi per invertire" : "Decrescente (Z-A) - premi per spegnere") : "Ordine predefinito - premi per ordinare A-Z";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label="Direzione ordinamento"
      className={`flex h-11 shrink-0 items-center justify-center border-2 px-3 text-xs font-semibold transition-colors ${
        active ? toggleActive : toggleInactive
      }`}
    >
      <span className={`inline-block transition-transform duration-150 ${flip ? "scale-y-0" : "scale-y-100"}`}>{label}</span>
    </button>
  );
}
