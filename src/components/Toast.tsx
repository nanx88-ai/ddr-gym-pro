"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error";
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

/**
 * Toast globale per confermare che un'operazione e' andata a buon fine (o
 * fallita), da usare dopo ogni azione che non richiede conferma preventiva
 * (le azioni distruttive chiedono conferma con window.confirm PRIMA, poi
 * mostrano comunque il toast di esito).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: "success" | "error") => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const value: ToastContextValue = {
    success: (message) => push(message, "success"),
    error: (message) => push(message, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
              t.kind === "success"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-red-600 text-white"
            }`}
          >
            {t.kind === "success" ? "✓" : "⚠"} {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast va usato dentro <ToastProvider>");
  return ctx;
}
