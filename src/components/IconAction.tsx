"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ActionIconKey =
  | "expand"
  | "pause"
  | "resume"
  | "archive"
  | "unarchive"
  | "delete"
  | "add"
  | "remove"
  | "activate"
  | "deactivate"
  | "edit"
  | "schedule"
  | "calendar"
  | "chevronLeft"
  | "chevronRight"
  | "today"
  | "viewDay"
  | "viewWeek"
  | "viewMonth"
  | "moreVertical";

const PATHS: Record<ActionIconKey, React.ReactNode> = {
  expand: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 3.5H3.5V9M15 3.5h5.5V9M20.5 15v5.5H15M9 20.5H3.5V15"
    />
  ),
  pause: <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14M16 5v14" />,
  resume: <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5v15l13-7.5-13-7.5Z" />,
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
    </>
  ),
  unarchive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M12 17v-4M9.5 15.5 12 13l2.5 2.5" />
    </>
  ),
  delete: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 7h14M9.5 7V4.5h5V7M7 7l1 13.5h8L17 7M10 11v6M14 11v6"
    />
  ),
  add: <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />,
  remove: <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />,
  activate: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  deactivate: <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />,
  edit: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 20.5h4.2L19 9.7a2 2 0 0 0 0-2.8l-1.9-1.9a2 2 0 0 0-2.8 0L3.5 15.8V20.5Z M14 6l4 4"
    />
  ),
  schedule: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  chevronLeft: <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />,
  chevronRight: <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />,
  today: (
    <>
      <rect x="3.5" y="5" width="17" height="16" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17" />
      <circle cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  viewDay: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 5.5h16M4 5.5v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-13M8 10h8M8 14h8"
    />
  ),
  viewWeek: (
    <>
      <rect x="3.5" y="4.5" width="4" height="15" />
      <rect x="10" y="4.5" width="4" height="15" />
      <rect x="16.5" y="4.5" width="4" height="15" />
    </>
  ),
  viewMonth: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <path strokeLinecap="round" d="M3.5 9h17M3.5 14.5h17M9 3.5v17M14.5 3.5v17" />
    </>
  ),
  moreVertical: (
    <>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
};

function ActionSvg({ icon }: { icon: ActionIconKey }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
      {PATHS[icon]}
    </svg>
  );
}

const TONE = {
  neutral:
    "border border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700",
  danger: "bg-red-600 text-white hover:bg-red-500",
  positive: "bg-green-600 text-white hover:bg-green-500",
};

type Tone = keyof typeof TONE;

interface BaseProps {
  icon: ActionIconKey;
  label: string;
  tone?: Tone;
  disabled?: boolean;
}

/**
 * Bottone/link icona con tooltip: al passaggio del mouse su desktop (title
 * nativo, gratis), a tap lungo su mobile (dove l'hover non esiste). `label`
 * resta sempre l'etichetta accessibile (aria-label + tooltip), cosi' il
 * significato dell'icona e' sempre recuperabile anche se non ovvio a colpo
 * d'occhio.
 */
function useLongPressTooltip() {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    timer.current = setTimeout(() => setShow(true), 450);
  }
  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }

  return {
    show,
    handlers: {
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchCancel: clear,
      onTouchMove: clear,
    },
  };
}

function Tooltip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-neutral-700">
      {label}
    </span>
  );
}

export function IconButton({
  icon,
  label,
  tone = "neutral",
  disabled,
  onClick,
}: BaseProps & { onClick: () => void }) {
  const { show, handlers } = useLongPressTooltip();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${TONE[tone]}`}
      {...handlers}
    >
      <Tooltip label={label} show={show} />
      <ActionSvg icon={icon} />
    </button>
  );
}

export function IconLink({ icon, label, tone = "neutral", href }: BaseProps & { href: string }) {
  const { show, handlers } = useLongPressTooltip();
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center transition-colors ${TONE[tone]}`}
      {...handlers}
    >
      <Tooltip label={label} show={show} />
      <ActionSvg icon={icon} />
    </Link>
  );
}

/** Wrapper per allineare sempre le azioni a destra, coerente su ogni colonna/riga. */
export function ActionsRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}

export interface MenuAction {
  key: string;
  icon: ActionIconKey;
  label: string;
  tone?: Tone;
  onClick: () => void;
  hidden?: boolean;
}

/**
 * Menu "..." per righe con troppe azioni possibili (conferma/rifiuta/
 * annulla/modifica/elimina...): invece di affiancare N bottoni icona che
 * rompono il layout su mobile, un solo trigger apre un dropdown squadrato
 * con la lista, sempre allineato a destra.
 *
 * Il dropdown va in un portal su document.body, posizionato via coordinate
 * fisse: se restasse figlio del trigger (position: absolute) verrebbe
 * tagliato da qualunque antenato con overflow-hidden (es. tableWrap) o dal
 * bordo della tabella - specialmente sull'ultima riga.
 */
export function ActionsMenu({ actions, label = "Azioni" }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = actions.filter((a) => !a.hidden);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onReposition() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 192;
      const estimatedHeight = visible.length * 44 + 8;
      const openUp = window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight;
      setCoords({
        top: openUp ? rect.top - estimatedHeight : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
        openUp,
      });
    }
    setOpen((o) => !o);
  }

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={label}
        title={label}
        className="flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <ActionSvg icon="moreVertical" />
      </button>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-[200] w-48 border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
          >
            {visible.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  a.tone === "danger" ? "text-red-600 dark:text-red-400" : "text-neutral-800 dark:text-neutral-100"
                }`}
              >
                <ActionSvg icon={a.icon} />
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
