"use client";

import { useEffect, useRef } from "react";
import { toggleInactive } from "@/lib/ui";

/**
 * Editor rich text minimale per il corpo delle email (Comunicazioni):
 * grassetto, corsivo, sottolineato, elenchi puntati/numerati. Basato su
 * contentEditable + document.execCommand: deprecato ma supportato ovunque
 * per questi comandi base, e ci evita una libreria esterna per un caso
 * d'uso cosi' ristretto. Il valore scambiato e' HTML (finisce dritto nel
 * corpo dell'email); scrive solo l'admin, quindi niente sanitizzazione.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sincronizza il DOM solo quando il valore cambia dall'esterno (es. reset
  // dopo l'invio): riscrivere innerHTML a ogni digitazione sposterebbe il
  // cursore all'inizio.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  const buttons: { command: string; title: string; content: React.ReactNode }[] = [
    { command: "bold", title: "Grassetto", content: <span className="font-bold">G</span> },
    { command: "italic", title: "Corsivo", content: <span className="italic">C</span> },
    { command: "underline", title: "Sottolineato", content: <span className="underline">S</span> },
    {
      command: "insertUnorderedList",
      title: "Elenco puntato",
      content: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      ),
    },
    {
      command: "insertOrderedList",
      title: "Elenco numerato",
      content: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" d="M10 6h10M10 12h10M10 18h10M4 5.5 5.5 4v4M4 11h2.5l-2.5 3h2.5M4 17h2a1 1 0 0 1 0 2H5a1 1 0 0 0 0 2h1.5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex gap-1 border-b border-neutral-200 p-1.5 dark:border-neutral-800">
        {buttons.map((b) => (
          <button
            key={b.command}
            type="button"
            title={b.title}
            // onMouseDown+preventDefault: il click non deve rubare il focus
            // (e la selezione) all'area di testo, altrimenti execCommand
            // non sa piu' a cosa applicarsi.
            onMouseDown={(e) => {
              e.preventDefault();
              exec(b.command);
            }}
            className={`flex h-9 w-9 items-center justify-center border text-sm transition-colors ${toggleInactive}`}
          >
            {b.content}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Corpo del messaggio"
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        // Placeholder via ::before quando vuoto: contentEditable non ha
        // l'attributo placeholder nativo.
        className="min-h-40 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-1 focus:ring-yellow-400 empty:before:pointer-events-none empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)] dark:text-neutral-100 dark:empty:before:text-neutral-500 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
