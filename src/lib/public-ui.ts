// Stile condiviso per il frontend pubblico di prenotazione: ispirato a
// Google/Apple, palette chiara, card arrotondate, tipografia pulita.

export const publicCard =
  "border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900";
export const publicInput =
  "w-full border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:ring-yellow-900/30";
export const publicLabel =
  "mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300";
// disabled: bordo neutro senza riempimento giallo (non solo "giallo attenuato",
// altrimenti resta troppo simile allo stato attivo e sembra ancora cliccabile).
export const publicBtnPrimary =
  "inline-flex items-center justify-center bg-yellow-400 px-6 py-3 text-sm font-semibold text-neutral-900 transition-[background-color,transform] duration-150 hover:bg-yellow-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 disabled:border disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-400 dark:disabled:border-neutral-700 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600";
export const publicBtnSecondary =
  "inline-flex items-center justify-center border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 transition-[background-color,transform] duration-150 hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
