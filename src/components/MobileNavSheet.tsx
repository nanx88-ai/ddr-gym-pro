"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NAV_GROUPS, NavIcon } from "@/components/AdminNav";

const DRAG_OPEN_THRESHOLD = 50;
const DRAG_CLOSE_THRESHOLD = 70;

const BG_BASE = "#0D0D0D";
const BG_CELL = "#1A1A1A";
const LINE = "#2A2A2A";
const YELLOW = "#F5C400";
const RED = "#E53935";

/**
 * Menu principale da mobile: non un burger+drawer laterale, ma una bottom
 * bar sempre visibile a tutta larghezza che si trascina (o si tocca) verso
 * l'alto per aprire una scheda a schermo intero con le sezioni a griglia,
 * stile "ERP dark block": griglia rigida a celle piene separate da linee
 * 1px, zero border-radius, zero ombre/gradienti, stato attivo = riempimento
 * giallo pieno.
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
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY, dragging: true };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
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
    dragState.current.dragging = false;
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

  return (
    <div className="sm:hidden">
      {/* Overlay a tutto schermo, piu' marcato di quello del pannello notifiche */}
      {open && <div className="fixed inset-0 z-40 bg-black/80" onClick={() => setOpen(false)} />}

      {/* Barra collassata: piena, a tutta larghezza, "Menu" allineato a sinistra */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="fixed inset-x-0 bottom-0 z-40 flex touch-none items-center gap-3 border-t px-4"
          style={{ backgroundColor: BG_BASE, borderColor: LINE, height: 52 }}
          aria-label="Apri menu"
        >
          <span className="h-1 w-8 shrink-0" style={{ backgroundColor: LINE }} />
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-300">Menu</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto h-4 w-4 text-neutral-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
          </svg>
        </button>
      )}
      {/* Spacer piatto per l'area gesture di sistema, sempre presente sotto la barra */}
      {!open && (
        <div
          className="fixed inset-x-0 bottom-0 z-40"
          style={{ backgroundColor: BG_BASE, height: "env(safe-area-inset-bottom)", marginBottom: 52 }}
        />
      )}

      {/* Scheda a schermo intero */}
      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col border-t"
          style={{
            backgroundColor: BG_BASE,
            borderColor: LINE,
            transform: `translateY(${dragY}px)`,
            transition: dragState.current?.dragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="touch-none"
          >
            <div className="flex justify-center pt-2.5 pb-1.5">
              <span className="h-1 w-10" style={{ backgroundColor: LINE }} />
            </div>
            <div className="px-4 pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-300">Menu</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border-t" style={{ borderColor: LINE }}>
            <div className="grid grid-cols-3">
              {gridItems.map((item) => {
                const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex aspect-square flex-col items-center justify-center gap-2 border p-2 text-center"
                    style={{
                      backgroundColor: isActive ? YELLOW : BG_CELL,
                      borderColor: LINE,
                      color: isActive ? "#0D0D0D" : "#E0E0E0",
                    }}
                  >
                    <NavIcon icon={item.icon} />
                    <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Bottom action bar: neutro a sinistra, distruttivo a destra, divisi da una linea */}
          <div className="flex border-t" style={{ borderColor: LINE, height: 52 }}>
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex flex-1 items-center justify-center gap-2 border-r text-sm font-medium text-neutral-200"
              style={{ borderColor: LINE }}
            >
              <NavIcon icon="settings" />
              Impostazioni
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex flex-1 items-center justify-center gap-2 text-sm font-medium"
              style={{ color: RED }}
            >
              <NavIcon icon="logout" />
              Esci
            </button>
          </div>

          {/* Safe area piatta per la home indicator, nessun contenuto dentro */}
          <div style={{ backgroundColor: BG_BASE, height: "env(safe-area-inset-bottom)" }} />
        </div>
      )}
    </div>
  );
}
