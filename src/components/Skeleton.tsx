import { card } from "@/lib/ui";

/** Barra grigia pulsante di larghezza/altezza libere: mattone base di ogni skeleton. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-none bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}

/**
 * Sostituisce il testo "Caricamento..." con un placeholder che ricalca la
 * forma reale del contenuto (card con 2-3 righe), cosi' la pagina non sembra
 * rotta/vuota durante il fetch iniziale. Usata per le viste a schede mobile
 * e per blocchi generici.
 */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${card} space-y-2 p-4`}>
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  );
}

/** Righe skeleton per una tabella desktop: da usare dentro un <tbody> esistente. */
export function SkeletonTableRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-neutral-100 dark:border-neutral-800">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton className="h-4 w-full max-w-32" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Blocco generico (es. sezioni/card singole non tabellari): N righe di larghezza variabile. */
export function SkeletonLines({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === count - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
