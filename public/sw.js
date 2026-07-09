const CACHE_NAME = "palestra-admin-v1";
const SHELL = ["/admin", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first per tutto: l'admin lavora su dati live, la cache serve solo
// come fallback offline per la shell base (non per le API).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// TODO (fase 2): gestione push notifications in tempo reale.
// Richiede: VAPID keys, endpoint per salvare le subscription lato server
// (tabella dedicata), e invio push da qui quando arriva una nuova richiesta
// di prenotazione. Non attivabile senza quella infrastruttura.
