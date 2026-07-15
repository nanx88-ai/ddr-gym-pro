"use client";

const STATE_STYLE: Record<string, string> = {
  unmarked: "border-neutral-300 text-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-800",
  present: "border-green-600 text-green-600 hover:bg-green-600 hover:text-white dark:border-green-500 dark:text-green-400",
  absent: "border-red-600 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-500 dark:text-red-400",
};

function stateOf(attended: boolean | null): "unmarked" | "present" | "absent" {
  if (attended === true) return "present";
  if (attended === false) return "absent";
  return "unmarked";
}

/** Prossimo stato nel ciclo: da segnare -> presente -> assente -> da segnare. */
function nextAttended(attended: boolean | null): boolean | null {
  if (attended === null) return true;
  if (attended === true) return false;
  return null;
}

/**
 * Stato di presenza per una prenotazione, riusato ovunque compaia un elenco
 * di appuntamenti di un cliente (Prenotazioni, Agenda, scheda cliente): un
 * solo bottone 44x44 (stessa dimensione di IconButton/"Azioni" accanto, mai
 * piu' basso) che cicla tra i 3 stati ad ogni tap. Il chiamante mostra un
 * toast di conferma dopo ogni cambio (vedi onChange).
 */
export default function AttendanceToggle({
  attended,
  onChange,
}: {
  attended: boolean | null;
  onChange: (attended: boolean | null) => void;
}) {
  const state = stateOf(attended);

  return (
    <button
      type="button"
      onClick={() => onChange(nextAttended(attended))}
      title={state === "present" ? "Presente (tocca per cambiare)" : state === "absent" ? "Assente (tocca per cambiare)" : "Da segnare (tocca per impostare)"}
      aria-label="Presenza"
      className={`flex h-11 w-11 shrink-0 items-center justify-center border-2 transition-colors ${STATE_STYLE[state]}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        {state === "present" && <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
        {state === "absent" && <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />}
        {state === "unmarked" && <circle cx="12" cy="12" r="7" strokeDasharray="3 3" />}
      </svg>
    </button>
  );
}
