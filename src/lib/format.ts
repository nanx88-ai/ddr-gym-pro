export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "In attesa di approvazione",
  APPROVED: "Confermata",
  REJECTED: "Rifiutata",
  CANCELLED: "Annullata",
  RESCHEDULE_REQUESTED: "Spostamento richiesto",
  RESCHEDULED: "Riprogrammata",
  ACTIVE: "Attivo",
  PAUSED: "In pausa",
  ARCHIVED: "Archiviato",
  PENDING: "In attesa",
  DRAFT: "Bozza",
  ISSUED: "Emessa",
  SENT: "Inviata",
  PAID: "Pagata",
  ERROR: "Errore invio",
  SUCCESS: "Riuscito",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
  CANCELLED: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-400",
  RESCHEDULE_REQUESTED: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  RESCHEDULED: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  PAUSED: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-400",
  ARCHIVED: "bg-neutral-300 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-500",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300",
  DRAFT: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-400",
  ISSUED: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  SENT: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  PAID: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
};

export function formatCurrency(amount: number) {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
