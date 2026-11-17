// CakeToHome service worker: installable PWA + push notifications.
// Deliberately caches nothing: pages and /api responses are per-user and must never be served stale.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  // Remove caches left by the old caching service worker.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "CakeToHome";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,
    renotify: Boolean(data.tag),
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // If the app is open, ask it to play the in-app alert sound.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) w.postMessage({ type: "cth-push", title, body: options.body, url: options.data.url });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => null);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
