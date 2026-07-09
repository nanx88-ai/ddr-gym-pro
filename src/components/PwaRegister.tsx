"use client";

import { useEffect } from "react";

/** Registra il service worker della PWA admin (installabile, shell in cache). */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
