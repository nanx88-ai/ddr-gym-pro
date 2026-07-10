"use client";

/**
 * Toggle presente/assente per una prenotazione, riusato ovunque compaia un
 * elenco di appuntamenti di un cliente (Prenotazioni, Agenda, scheda
 * cliente). Di default si presume la presenza (attended === null si mostra
 * come"Presente"): l'admin puo'segnare l'assenza in qualsiasi momento, e
 * tornare indietro altrettanto facilmente, e'sempre reversibile.
 */
export default function AttendanceToggle({
  attended,
  onChange,
  size = "sm",
}: {
  attended: boolean | null;
  onChange: (attended: boolean) => void;
  size?: "sm" | "xs";
}) {
  const isAbsent = attended === false;
  const pad = size === "xs" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs";

  return (
    <div className="flex overflow-hidden border border-neutral-300 dark:border-neutral-700">
      <button
        type="button"
        onClick={() => onChange(true)}
        title="Segna presente"
        className={`${pad} font-medium transition-colors ${
          !isAbsent
            ? "bg-green-600 text-white"
            : "bg-white text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
      >
        Presente
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        title="Segna assente"
        className={`${pad} font-medium transition-colors ${
          isAbsent
            ? "bg-red-600 text-white"
            : "bg-white text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
      >
        Assente
      </button>
    </div>
  );
}
