/*
  PT-BR: Service worker do OpenLingo — cache do "shell" para funcionar offline e instalar como app.
  EN:    OpenLingo service worker — caches the app shell for offline use / installability.
  Obs: chamadas /api/* nunca são cacheadas (precisam do Ollama ao vivo).
*/
const CACHE = "openlingo-react-v1";
// PT-BR: no React os assets têm hash; o cache é network-first em runtime. Precache só o essencial.
// EN: React assets are hashed; caching is network-first at runtime. Precache only the essentials.
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// PT-BR: network-first — sempre busca a versão mais nova; usa o cache só como fallback offline.
// EN: network-first — always fetch the latest; fall back to cache only when offline.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // PT-BR: API sempre ao vivo. EN: API always live.
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
