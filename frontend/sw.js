/*
  PT-BR: Service worker do OpenLingo — cache do "shell" para funcionar offline e instalar como app.
  EN:    OpenLingo service worker — caches the app shell for offline use / installability.
  Obs: chamadas /api/* nunca são cacheadas (precisam do Ollama ao vivo).
*/
const CACHE = "openlingo-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // PT-BR: API sempre ao vivo. EN: API always live.
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
