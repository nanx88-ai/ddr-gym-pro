"use client";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/**
 * Checkbox custom: quadratino con bordo giallo, sempre vuoto, spunta gialla
 * quando selezionato (niente riempimento pieno come nei checkbox nativi/accent-color).
 * h-6 w-6 (24px) = minimo WCAG 2.5.5 per target di tap.
 */
export function Checkbox(props: CheckboxProps) {
  return (
    <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none border-2 border-yellow-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-yellow-400"
        {...props}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="pointer-events-none h-4 w-4 text-yellow-600 opacity-0 peer-checked:opacity-100 dark:text-yellow-400"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}
