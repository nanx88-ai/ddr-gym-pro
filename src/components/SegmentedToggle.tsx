"use client";

import { toggleActive } from "@/lib/ui";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Bordo/testo quando questa opzione e' selezionata; default = giallo standard (toggleActive). */
  activeClassName?: string;
}

/**
 * Toggle a segmenti riusabile per 2+ opzioni mutuamente esclusive: bordo
 * colorato vuoto quando selezionata, hover che riempie; le altre opzioni
 * restano smorzate. Stessa interazione ovunque compaia una scelta binaria
 * "questo o quello" (presente/assente, singola/ricorrente, numero di
 * volte/data di fine) - il colore attivo e' personalizzabile per opzione
 * (es. verde per "presente", rosso per "assente").
 */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "xs";
  className?: string;
}) {
  const pad = size === "xs" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs";

  return (
    <div className={`flex overflow-hidden border border-neutral-300 dark:border-neutral-700 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`flex-1 border-2 font-medium transition-colors ${pad} ${
              active
                ? (opt.activeClassName ?? toggleActive)
                : "border-transparent bg-white text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
