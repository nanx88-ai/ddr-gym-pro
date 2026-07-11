"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NAV_GROUPS, NavIcon } from "@/components/AdminNav";

const DRAG_OPEN_THRESHOLD = 50;
const DRAG_CLOSE_THRESHOLD = 70;
const BAR_HEIGHT = 52;
// Zona morta sotto la barra collassata: senza handler, cosi' la gesture
// "swipe up" di iOS per chiudere le app non entra in conflitto col
// trascinamento del nostro menu. L'Apple HIG riserva 34pt alla home
// indicator sui device senza tasto Home (env(safe-area-inset-bottom));
// aggiungiamo un margine di 8pt di cuscinetto. Su device piu' vecchi/Android
// senza quell'inset usiamo comunque 34px come minimo di sicurezza.
const BOTTOM_DEAD_ZONE = "calc(max(env(safe-area-inset-bottom), 34px) + 8px)";

const SURFACE = "bg-white dark:bg-[#0D0D0D]";
const LINE = "border-neutral-200 dark:border-[#2A2A2A]";
const CELL = "bg-neutral-100 dark:bg-[#1A1A1A]";
const TEXT_MUTED = "text-neutral-500 dark:text-neutral-400";
const TEXT_LABEL = "text-neutral-700 dark:text-neutral-300";
const TEXT_CELL = "text-neutral-800 dark:text-[#E0E0E0]";

/**
 * Menu principale da mobile: non un burger+drawer laterale, ma una bottom
 * bar sempre visibile a tutta larghezza che si trascina (o si tocca) verso
 * l'alto per aprire una scheda a schermo intero con le sezioni a griglia,
 * stile "ERP block": griglia rigida a celle piene separate da linee 1px,
 * zero border-radius, zero ombre/gradienti, stato attivo = riempimento
 * giallo pieno. Segue il tema chiaro/scuro dell'admin (classe .dark).
 */
export default function MobileNavSheet({
  pathname,
  onLogout,
}: {
  pathname: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startY: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const delta = e.clientY - dragState.current.startY;
    if (open) {
      // trascina verso il basso per chiudere
      setDragY(Math.max(0, delta));
    } else {
      // trascina verso l'alto per aprire (delta negativo)
      setDragY(Math.min(0, delta));
    }
  }

  function onPointerUp() {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    if (open && dragY > DRAG_CLOSE_THRESHOLD) {
      setOpen(false);
    } else if (!open && dragY < -DRAG_OPEN_THRESHOLD) {
      setOpen(true);
    }
    setDragY(0);
  }

  // L'ultimo gruppo (Impostazioni) e' mostrato a parte nella bottom action
  // bar, insieme a Esci.
  const gridItems = NAV_GROUPS.slice(0, -1).flatMap((g) => g.items);

  const grid = (
    <div className="grid grid-cols-3">
      {gridItems.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex aspect-square flex-col items-center justify-center gap-2 border p-2 text-center transition-colors ${
              isActive
                ? "border-yellow-500 bg-transparent text-yellow-600 hover:bg-yellow-400 hover:text-neutral-900 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-400 dark:hover:text-neutral-900"
                : `${LINE} ${CELL} ${TEXT_CELL}`
            }`}
          >
            <NavIcon icon={item.icon} />
            <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="sm:hidden">
      {/* Overlay a tutto schermo, piu' marcato di quello del pannello notifiche */}
      {open && <div className="fixed inset-0 z-40 bg-black/80" onClick={() => setOpen(false)} />}

      {/* Barra collassata: sollevata dal bordo, con zona morta non interattiva
          sotto per non entrare in conflitto con la gesture bar iOS */}
      {!open && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 ${SURFACE}`}
          style={{ height: `calc(${BAR_HEIGHT}px + ${BOTTOM_DEAD_ZONE})` }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`relative flex w-full touch-none items-center border-t px-4 ${SURFACE} ${LINE}`}
            style={{
              height: BAR_HEIGHT,
              transform: `translateY(${dragY}px)`,
              transition: dragging ? "none" : "transform 0.2s ease-out",
            }}
            aria-label="Apri menu"
          >
            <span className={`text-xs font-semibold uppercase tracking-wide ${TEXT_LABEL}`}>Menu</span>
            <span className="absolute inset-x-0 flex justify-center">
              <span className={`h-1 w-10 border ${LINE}`} />
            </span>
          </button>
          {/* zona morta: nessun handler, lascia passare le gesture di sistema */}
        </div>
      )}

      {/* Anteprima durante il trascinamento verso l'alto: mostra subito una
          fetta del pannello invece di un'area vuota finche' non si supera la
          soglia di apertura. */}
      {!open && dragging && dragY < 0 && (
        <div
          className={`fixed inset-x-0 z-40 overflow-hidden border-t ${SURFACE} ${LINE}`}
          style={{ bottom: `calc(${BAR_HEIGHT}px + ${BOTTOM_DEAD_ZONE})`, height: Math.min(-dragY, 480) }}
        >
          {grid}
        </div>
      )}

      {/* Scheda a schermo intero */}
      {open && (
        <div
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col border-t ${SURFACE} ${LINE}`}
          style={{
            transform: `translateY(${dragY}px)`,
            transition: dragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative flex w-full touch-none items-center px-4"
            style={{ height: BAR_HEIGHT }}
            aria-label="Chiudi menu"
          >
            <span className={`text-xs font-semibold uppercase tracking-wide ${TEXT_LABEL}`}>Menu</span>
            <span className="absolute inset-x-0 flex justify-center">
              <span className={`h-1 w-10 border ${LINE}`} />
            </span>
          </button>

          <div className={`flex-1 overflow-y-auto border-t ${LINE}`}>{grid}</div>

          {/* Bottom action bar: neutro a sinistra, distruttivo a destra, divisi da una linea */}
          <div className={`flex border-t ${LINE}`} style={{ height: 52 }}>
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className={`flex flex-1 items-center justify-center gap-2 border-r text-sm font-medium ${LINE} ${TEXT_LABEL}`}
            >
              <NavIcon icon="settings" />
              Impostazioni
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex flex-1 items-center justify-center gap-2 text-sm font-medium text-red-600 dark:text-red-400"
            >
              <NavIcon icon="logout" />
              Esci
            </button>
          </div>

          {/* Safe area piatta per la home indicator, nessun contenuto dentro */}
          <div className={SURFACE} style={{ height: "env(safe-area-inset-bottom)" }} />
        </div>
      )}
    </div>
  );
}
