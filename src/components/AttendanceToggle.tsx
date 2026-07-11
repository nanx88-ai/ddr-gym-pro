"use client";

import { SegmentedToggle } from "@/components/SegmentedToggle";

const PRESENT_ACTIVE =
  "border-green-600 bg-transparent text-green-700 hover:bg-green-600 hover:text-white dark:border-green-500 dark:text-green-400";
const ABSENT_ACTIVE =
  "border-red-600 bg-transparent text-red-700 hover:bg-red-600 hover:text-white dark:border-red-500 dark:text-red-400";

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
  return (
    <SegmentedToggle
      size={size}
      value={attended === false ? "absent" : "present"}
      onChange={(v) => onChange(v === "present")}
      options={[
        { value: "present", label: "Presente", activeClassName: PRESENT_ACTIVE },
        { value: "absent", label: "Assente", activeClassName: ABSENT_ACTIVE },
      ]}
    />
  );
}
