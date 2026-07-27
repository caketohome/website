const CACHE_NAME = "caketohome-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/medusa-logo.svg",
  "/next.svg",
  "/notification.mp3",
  "/pizza-loading.gif",
];

// On install, pre-cache the offline page and static images
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network First for catalog APIs & HTML pages, Cache First for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Network First Strategy for pages/APIs
  if (
    event.request.mode === "navigate" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/store/")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline, check cache fallback
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If page navigation fails, return offline fallback page
            if (event.request.mode === "navigate") {
              return caches.match("/offline");
            }
            return new Response(
              JSON.stringify({ error: "Offline mode. Cached data missing." }),
              {
                headers: { "Content-Type": "application/json" },
                status: 503,
              }
            );
          });
        })
    );
    return;
  }

  // Cache First Strategy for static assets and scripts
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
