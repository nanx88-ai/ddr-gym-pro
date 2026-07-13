"use client";

import { useEffect, useState } from "react";
import { publicCard } from "@/lib/public-ui";
import { formatCurrency } from "@/lib/format";

interface Tariff {
  id: string;
  title: string;
  subtitle: string | null;
  quantity: string | null;
  price: number;
}

/**
 * Voce "Guarda le tariffe" in coda ai servizi prenotabili: apre un overlay
 * (bottom sheet su mobile, modale centrata su desktop) con il tariffario
 * pubblico gestito dall'admin nella sezione Tariffe.
 */
export function TariffsSheet() {
  const [open, setOpen] = useState(false);
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);

  // Carica al primo open, poi riusa (non cambia durante la sessione).
  useEffect(() => {
    if (!open || tariffs !== null) return;
    fetch("/api/tariffs")
      .then((res) => res.json())
      .then((json) => setTariffs(json.items ?? []))
      .catch(() => setTariffs([]));
  }, [open, tariffs]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${publicCard} flex w-full items-center justify-between p-4 text-left transition-colors hover:border-yellow-400`}
      >
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5 shrink-0 text-yellow-500 dark:text-yellow-400"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.5 12.5v-8a1 1 0 0 1 1-1h8L20.5 11a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-8-7.5Z"
            />
            <path strokeLinecap="round" d="M8 8h.01" />
          </svg>
          <div>
            <div className="font-semibold text-neutral-900 dark:text-white">Guarda le tariffe</div>
            <div className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Prezzi e abbonamenti</div>
          </div>
        </div>
        <span className="text-neutral-300 dark:text-neutral-600">&rarr;</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tariffe"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full flex-col bg-white dark:bg-neutral-900 sm:max-w-md sm:border sm:border-neutral-200 sm:shadow-lg sm:dark:border-neutral-800"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Tariffe</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                className="flex h-11 w-11 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div
              className="overflow-y-auto px-5 py-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            >
              {tariffs === null && (
                <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
              )}
              {tariffs !== null && tariffs.length === 0 && (
                <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Nessuna tariffa disponibile al momento.
                </p>
              )}
              {tariffs?.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex items-baseline justify-between gap-4 py-3.5 ${
                    i > 0 ? "border-t border-neutral-100 dark:border-neutral-800" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900 dark:text-white">{t.title}</p>
                    {t.subtitle && <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{t.subtitle}</p>}
                    {t.quantity && <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{t.quantity}</p>}
                  </div>
                  <p className="shrink-0 font-semibold text-yellow-600 dark:text-yellow-400">{formatCurrency(t.price)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
