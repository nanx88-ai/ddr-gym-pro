"use client";

import { useEffect, useState } from "react";
import {
  getStoredTheme,
  setStoredTheme,
  THEME_CHANGE_EVENT,
} from "@/lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
    const onChange = (e: Event) => setTheme((e as CustomEvent).detail);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="min-h-11 border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      title="Cambia tema"
    >
      {theme === "dark" ? "🌙 Scuro" : "☀️ Chiaro"}
    </button>
  );
}
