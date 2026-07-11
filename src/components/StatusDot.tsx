import { STATUS_DOT_COLORS, STATUS_LABELS } from "@/lib/format";

/**
 * Pallino colorato per lo stato di una riga (sostituisce la colonna "Stato"
 * testuale, ridondante quando lo stato e' gia' esposto come azione nel menu
 * della riga). Il colore identifica lo stato, il testo con lo stato esteso
 * compare al passaggio del mouse tramite il title nativo.
 */
export function StatusDot({ status, label, className = "" }: { status: string; label?: string; className?: string }) {
  const color = STATUS_DOT_COLORS[status] ?? "bg-neutral-400";
  const title = label ?? STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color} ${className}`}
      title={title}
      aria-label={title}
      role="img"
    />
  );
}
