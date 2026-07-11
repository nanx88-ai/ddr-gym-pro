// Classi Tailwind condivise per la UI admin: light di base, dark: opzionale
// (classe .dark su <html>, vedi ThemeToggle), bianco/nero a contrasto,
// accento giallo, verde per azioni positive, rosso per azioni distruttive.

export const btnPrimary =
  "min-h-11 border-2 border-yellow-500 bg-transparent px-4 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-400 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-400 dark:hover:text-neutral-900";

export const btnPositive =
  "min-h-11 border-2 border-green-600 bg-transparent px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-green-500 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white";

export const btnDanger =
  "min-h-11 border-2 border-red-600 bg-transparent px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-red-500 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white";

export const btnNeutral =
  "min-h-11 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700";

export const btnGhost =
  "min-h-11 px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

export const linkText = "text-sm font-medium hover:underline";
export const linkPositive = `${linkText} text-green-600 dark:text-green-400`;
export const linkDanger = `${linkText} text-red-600 dark:text-red-400`;
export const linkNeutral = `${linkText} text-neutral-500 dark:text-neutral-400`;

export const card =
  "border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900";
export const cardPadded = `${card} p-4`;

// text-base (16px) sotto sm: sotto i 16px iOS Safari fa zoom automatico al
// focus dell'input, fastidioso e non richiesto qui - da sm: in su si torna a
// text-sm per densita' su schermi piu' larghi dove lo zoom non scatta.
export const input =
  "w-full min-h-11 border border-neutral-300 bg-white px-3 py-2 text-base sm:text-sm text-neutral-900 placeholder-neutral-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-yellow-400 dark:focus:ring-yellow-400";

export const label =
  "mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-300";

export const pageTitle =
  "mb-1 text-xl font-bold text-neutral-900 dark:text-white";
export const pageSubtitle =
  "mb-4 text-sm text-neutral-500 dark:text-neutral-400";

export const tableWrap = `${card} overflow-hidden`;
export const th =
  "px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500";
export const td = "px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200";
export const trBorder = "border-t border-neutral-200 dark:border-neutral-800";

export const pageBg =
  "min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100";
export const headerBg =
  "border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900";
export const tableHeadBg =
  "border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60";

export const errorBox =
  "mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300";
export const successBox =
  "mb-4 border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300";
