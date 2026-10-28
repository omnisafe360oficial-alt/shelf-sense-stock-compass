const CACHE = "omnisafe-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  // Só intercepta GET; ignora Supabase, APIs externas e websockets
  if (e.request.method !== "GET") return;
  if (!url.startsWith(self.location.origin)) return;
  if (url.includes("supabase.co") || url.includes("/_build/") || url.includes("@vite")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      // Stale-while-revalidate: retorna cache imediatamente se disponível
      return cached || network;
    })
  );
});
