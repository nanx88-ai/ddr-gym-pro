"use client";

import { useEffect, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { toIsoDate } from "@/lib/recurrence";

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface MonthCalendarProps {
  selected: string | null;
  onSelect: (iso: string) => void;
  /** Date (iso) completamente piene/chiuse: vengono mostrate desaturate e non selezionabili. */
  fullDates?: Set<string>;
  /** Chiamato quando l'utente cambia mese, cosi' il chiamante puo' ricaricare `fullDates`. */
  onMonthChange?: (monthIso: string) => void;
}

/**
 * Calendario mensile a griglia: tutte le date del mese sempre visibili (nessuno
 * scroll orizzontale che ne nasconda alcune), riempie lo spazio verticale
 * disponibile. Sostituisce lo strip orizzontale di giorni, poco leggibile su
 * mobile.
 */
export default function MonthCalendar({ selected, onSelect, fullDates, onMonthChange }: MonthCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(selected ? new Date(selected) : new Date()));
  const today = startOfDay(new Date());

  useEffect(() => {
    onMonthChange?.(format(month, "yyyy-MM"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex min-h-[60vh] flex-col sm:min-h-[420px]">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          aria-label="Mese precedente"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          &larr;
        </button>
        <span className="text-sm font-semibold capitalize text-neutral-900 dark:text-white">
          {format(month, "MMMM yyyy", { locale: it })}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Mese successivo"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium uppercase text-neutral-400 dark:text-neutral-500">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {weeks.map((week) =>
          week.map((day) => {
            const iso = toIsoDate(day);
            const inMonth = isSameMonth(day, month);
            const isPast = isBefore(day, today);
            const isFull = !isPast && fullDates?.has(iso);
            const isSelected = selected === iso;
            const isToday = isSameDay(day, today);
            const disabled = isPast || !inMonth || isFull;
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(iso)}
                className={`flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                  !inMonth
                    ? "invisible"
                    : isPast
                      ? "cursor-not-allowed text-neutral-300 dark:text-neutral-700"
                      : isFull
                        ? "cursor-not-allowed text-neutral-300 opacity-50 grayscale dark:text-neutral-600"
                        : isSelected
                          ? "bg-yellow-400 text-neutral-900"
                          : isToday
                            ? "border border-yellow-400 text-neutral-900 hover:bg-yellow-50 dark:text-white dark:hover:bg-yellow-400/10"
                            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                {day.getDate()}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
