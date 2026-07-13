"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { NAV_GROUPS, NavIcon } from "@/components/AdminNav";
import { toggleActive } from "@/lib/ui";

// Soglie di trascinamento: DRAG_STEP fa avanzare/tornare indietro di un
// livello (chiuso<->ridotto<->esteso), DRAG_LONG da chiuso salta
// direttamente a esteso in un unico gesto piu' lungo, DRAG_CLOSE (da
// ridotto, trascinando verso il basso) chiude del tutto.
const DRAG_STEP = 50;
const DRAG_LONG = 140;
const DRAG_CLOSE = 70;
const BAR_HEIGHT = 52;
// Zona morta sotto la barra collassata: senza handler, cosi' la gesture
// "swipe up" di iOS per chiudere le app non entra in conflitto col
// trascinamento del nostro menu. L'Apple HIG riserva 34pt alla home
// indicator sui device senza tasto Home (env(safe-area-inset-bottom));
// aggiungiamo un margine di 8pt di cuscinetto. Su device piu' vecchi/Android
// senza quell'inset usiamo comunque 34px come minimo di sicurezza.
const BOTTOM_DEAD_ZONE = "calc(max(env(safe-area-inset-bottom), 34px) + 8px)";

const SURFACE = "bg-white dark:bg-neutral-950";
const LINE = "border-neutral-200 dark:border-neutral-800";
const CELL = "bg-neutral-100 dark:bg-neutral-900";
const TEXT_LABEL = "text-neutral-700 dark:text-neutral-300";
const TEXT_CELL = "text-neutral-800 dark:text-neutral-200";

type ViewState = "closed" | "small" | "full";

/**
 * SPERIMENTALE (in prova, revertibile): menu principale da mobile a 3
 * livelli. Chiuso -> tocco/drag leggero apre "ridotto" (solo le 3 voci
 * principali, "Espandi" nella maniglia); da li' un drag leggero verso
 * l'alto (o tap su "Espandi") apre "esteso" (tutte le 9 voci + barra
 * impostazioni/esci); un drag piu' lungo da chiuso salta direttamente a
 * esteso.
 *
 * Il contenuto (maniglia + griglia + barra impostazioni/esci) e' un unico
 * blocco sempre della stessa altezza naturale: a cambiare e' solo quanto ne
 * resta "sotto il bordo dello schermo" tramite un singolo translateY -
 * qualunque punto della card si afferri (maniglia o "Espandi"), tutto il
 * resto sotto si muove insieme, in blocco, sempre come se si stesse aprendo
 * di piu' o richiudendo la stessa carta - mai un pezzo fermo e un altro che
 * cresce per conto suo.
 */
export default function MobileNavSheet({
  pathname,
  onLogout,
}: {
  pathname: string;
  onLogout: () => void;
}) {
  const [state, setState] = useState<ViewState>("closed");
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startY: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fullGridHeight, setFullGridHeight] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  useLayoutEffect(() => {
    function measure() {
      if (gridRef.current) setFullGridHeight(gridRef.current.scrollHeight);
      if (contentRef.current) setNaturalHeight(contentRef.current.scrollHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [state]);

  // Le voci (tranne l'ultimo gruppo, vedi gridItems) stanno su 3 colonne in
  // righe di uguale altezza (celle aspect-square): "ridotto" mostra
  // esattamente la maniglia + la prima riga, qualunque sia il numero di righe.
  const gridRows = Math.max(1, Math.ceil(NAV_GROUPS.slice(0, -1).flatMap((g) => g.items).length / 3));
  const smallVisibleHeight = BAR_HEIGHT + fullGridHeight / gridRows;

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY };
    setDragging(true);
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // pointer non piu' attivo (raro, safety net): il trascinamento continua comunque via stato React
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const delta = e.clientY - dragState.current.startY;
    if (state === "closed") setDragY(Math.min(0, delta));
    else if (state === "full") setDragY(Math.max(0, delta));
    else setDragY(delta);
  }

  function onPointerUp() {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    if (state === "closed") {
      if (dragY <= -DRAG_LONG) setState("full");
      else if (dragY <= -DRAG_STEP) setState("small");
    } else if (state === "small") {
      if (dragY <= -DRAG_STEP) setState("full");
      else if (dragY >= DRAG_CLOSE) setState("closed");
    } else {
      if (dragY >= DRAG_STEP) setState("small");
    }
    setDragY(0);
  }

  /** Tocco semplice (non trascinamento) sulla barra maniglia: un livello alla volta. */
  function handleTap() {
    if (state === "closed") setState("small");
    else if (state === "small") setState("closed");
    else setState("small");
  }

  /** "Espandi"/"Socchiudi" nella maniglia: stessa posizione, azione opposta a seconda del livello. */
  function expandCollapseTap(e: React.MouseEvent) {
    e.stopPropagation();
    setState(state === "small" ? "full" : "small");
  }

  // L'ultimo gruppo (Impostazioni) e' mostrato a parte nella bottom action
  // bar, insieme a Esci.
  const gridItems = NAV_GROUPS.slice(0, -1).flatMap((g) => g.items);

  const gridChildren = gridItems.map((item) => {
    const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setState("closed")}
        className={`flex aspect-square flex-col items-center justify-center gap-2 border p-2 text-center transition-colors ${
          isActive ? `bg-transparent ${toggleActive}` : `${LINE} ${CELL} ${TEXT_CELL}`
        }`}
      >
        <NavIcon icon={item.icon} />
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide">{item.label}</span>
      </Link>
    );
  });

  // translateY della card aperta: 0 = tutto visibile (esteso), (naturalHeight
  // - smallVisibleHeight) = solo maniglia+prima riga poking su (ridotto).
  // Durante il trascinamento e' il valore live che segue il dito in ogni
  // direzione - un solo numero sposta l'intera card in blocco, qualunque
  // punto si stia trascinando.
  const restingTranslateY = state === "full" ? 0 : naturalHeight - smallVisibleHeight;
  const sheetTranslateY = dragging
    ? Math.min(naturalHeight, Math.max(0, restingTranslateY + dragY))
    : restingTranslateY;

  const settingsFocusable = state === "full" ? undefined : -1;

  return (
    <div className="sm:hidden">
      {/* Copia invisibile sempre presente, solo per misurare l'altezza reale
          della griglia completa (dipende dalla larghezza schermo per via
          delle celle aspect-square) prima ancora che l'utente apra il menu. */}
      <div ref={gridRef} className="invisible fixed inset-x-0 top-0 -z-10 grid grid-cols-3" aria-hidden>
        {gridChildren}
      </div>

      {/* Overlay a tutto schermo: chiude sempre del tutto, indipendentemente dal livello */}
      {state !== "closed" && (
        <div className="fixed inset-0 z-40 bg-black/80" onClick={() => setState("closed")} />
      )}

      {/* Barra collassata: sollevata dal bordo, con zona morta non interattiva
          sotto per non entrare in conflitto con la gesture bar iOS */}
      {state === "closed" && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 ${SURFACE}`}
          style={{ height: `calc(${BAR_HEIGHT}px + ${BOTTOM_DEAD_ZONE})` }}
        >
          <button
            type="button"
            onClick={handleTap}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`flex w-full touch-none items-center justify-between border-t px-4 ${SURFACE} ${LINE}`}
            style={{ height: BAR_HEIGHT }}
            aria-label="Apri menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-neutral-600 dark:text-neutral-400">
              <path strokeLinecap="round" d="M6 15l6-6 6 6" />
            </svg>
            <img src="/logo-ddr-white.png" alt="DDR" className="h-6 w-auto" loading="lazy" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-neutral-600 dark:text-neutral-400">
              <path strokeLinecap="round" d="M6 15l6-6 6 6" />
            </svg>
          </button>
          {/* zona morta: nessun handler, lascia passare le gesture di sistema */}
        </div>
      )}

      {/* Anteprima durante il trascinamento verso l'alto da chiuso: la
          stessa griglia completa, via via piu' scoperta man mano che si
          trascina - mai un contenuto diverso a scatto. */}
      {state === "closed" && dragging && dragY < 0 && (
        <div
          className={`fixed inset-x-0 z-40 overflow-hidden border-t ${SURFACE} ${LINE}`}
          style={{ bottom: `calc(${BAR_HEIGHT}px + ${BOTTOM_DEAD_ZONE})`, height: Math.min(-dragY, fullGridHeight) }}
        >
          <div className="grid grid-cols-3">{gridChildren}</div>
        </div>
      )}

      {/* Scheda aperta: un unico blocco a altezza naturale (maniglia +
          griglia completa + barra impostazioni/esci), "ridotta" o "estesa"
          solo tramite translateY - mai contenuto diverso, mai un pezzo
          fermo mentre un altro si muove. */}
      {state !== "closed" && (
        <div
          ref={contentRef}
          className={`fixed inset-x-0 bottom-0 z-50 flex flex-col border-t ${SURFACE} ${LINE}`}
          style={{
            transform: `translateY(${sheetTranslateY}px)`,
            transition: dragging ? "none" : "transform 0.22s ease-out",
          }}
        >
          <button
            type="button"
            onClick={handleTap}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex w-full touch-none items-center justify-between px-4"
            style={{ height: BAR_HEIGHT }}
            aria-label={state === "full" ? "Riduci menu" : "Espandi menu"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-neutral-600 dark:text-neutral-400">
              <path strokeLinecap="round" d={state === "full" ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
            </svg>
            <img src="/logo-ddr-white.png" alt="DDR" className="h-6 w-auto" loading="lazy" />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 text-neutral-600 dark:text-neutral-400 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                expandCollapseTap(e as any);
              }}
            >
              <path strokeLinecap="round" d={state === "full" ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
            </svg>
          </button>

          <div className={`border-t ${LINE}`}>
            <div className="grid grid-cols-3">{gridChildren}</div>
          </div>

          {/* Bottom action bar: neutro a sinistra, distruttivo a destra, divisi da una linea.
              Sempre presente (non solo in "esteso"): resta semplicemente
              sotto al bordo schermo quando "ridotto", parte dello stesso
              blocco che si sposta in translateY. */}
          <div className={`flex border-t ${LINE}`} style={{ height: BAR_HEIGHT }}>
            <Link
              href="/admin/settings"
              tabIndex={settingsFocusable}
              onClick={() => setState("closed")}
              className={`flex flex-1 items-center justify-center gap-2 border-r text-sm font-medium ${LINE} ${TEXT_LABEL}`}
            >
              <NavIcon icon="settings" />
              Impostazioni
            </Link>
            <button
              tabIndex={settingsFocusable}
              onClick={() => {
                setState("closed");
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
