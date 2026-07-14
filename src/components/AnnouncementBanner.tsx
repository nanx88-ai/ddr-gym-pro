"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string | null;
  body: string;
}

/**
 * Banner "bacheca" sulla pagina pubblica di prenotazione: mostra l'annuncio
 * attivo (al piu' uno, gestito dall'admin in Comunicazioni). Se non c'e'
 * nulla in bacheca non occupa spazio.
 */
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    fetch("/api/announcement")
      .then((res) => res.json())
      .then((json) => setAnnouncement(json.item ?? null))
      .catch(() => {});
  }, []);

  if (!announcement) return null;

  return (
    <div
      role="status"
      className="mb-4 flex gap-3 border border-yellow-300 bg-yellow-50 p-3.5 dark:border-yellow-700/60 dark:bg-yellow-950/30 sm:p-4"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 4.5v13l-7-3.5H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h6l7-3.5ZM8.5 14v4.5a1.5 1.5 0 0 0 3 0V14"
        />
      </svg>
      <div className="min-w-0">
        {announcement.title && (
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{announcement.title}</p>
        )}
        <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-200">{announcement.body}</p>
      </div>
    </div>
  );
}
