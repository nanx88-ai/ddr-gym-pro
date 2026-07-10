"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NAV_GROUPS, NavIcon } from "@/components/AdminNav";

const DRAG_OPEN_THRESHOLD = 50;
const DRAG_CLOSE_THRESHOLD = 70;

/**
 * Menu principale da mobile: non un burger+drawer laterale, ma una bottom
 * bar sempre visibile che si trascina (o si tocca) verso l'alto per aprire
 * una scheda a schermo intero con le sezioni a griglia (tipo "carrello" da
 * e-commerce). La barra collassata sta staccata dal bordo inferiore vero
 * (mb-2) per non entrare in conflitto con le gesture di sistema iOS/Android
 * in quella zona.
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

  // L'ultimo gruppo (Impostazioni) e' mostrato a parte nella riga in fondo,
  // insieme a Esci, come nel wireframe fornito.
  const gridItems = NAV_GROUPS.slice(0, -1).flatMap((g) => g.items);

  return (
    <div className="sm:hidden">
      {/* Overlay a tutto schermo, piu' marcato di quello del pannello notifiche */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/80" onClick={() => setOpen(false)} />
      )}

      {/* Barra collassata: staccata dal bordo per le gesture di sistema */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="fixed inset-x-3 bottom-2 z-40 flex h-14 touch-none flex-col items-center justify-center gap-1 border border-neutral-800 bg-neutral-900 text-neutral-300 shadow-lg"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Apri menu"
        >
          <span className="h-1 w-10 bg-neutral-600" />
          <span className="text-xs font-medium">Menu</span>
        </button>
      )}

      {/* Scheda a schermo intero */}
      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col border-t border-neutral-800 bg-neutral-950 shadow-2xl"
          style={{
            transform: `translateY(${dragY}px)`,
            transition: dragState.current?.dragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex touch-none flex-col items-center gap-2 py-3"
          >
            <span className="h-1 w-10 bg-neutral-700" />
            <span className="text-sm font-semibold text-white">Menu</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-2">
            <div className="grid grid-cols-3 gap-3">
              {gridItems.map((item) => {
                const isActive =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex aspect-square flex-col items-center justify-center gap-2 border p-2 text-center ${
                      isActive
                        ? "border-yellow-400 bg-yellow-400 text-neutral-900"
                        : "border-neutral-800 bg-neutral-900 text-neutral-200"
                    }`}
                  >
                    <NavIcon icon={item.icon} />
                    <span className="text-xs font-medium leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div
            className="flex items-center justify-between border-t border-neutral-800 px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
          >
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-sm text-neutral-300"
            >
              <NavIcon icon="settings" />
              Impostazioni
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex items-center gap-2 text-sm text-red-400"
            >
              <NavIcon icon="logout" />
              Esci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
