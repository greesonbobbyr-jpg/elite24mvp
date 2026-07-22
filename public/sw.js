// Elite24MVP service worker — Web Push only (no offline caching yet).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* fall back to defaults */
  }
  const title = data.title || "Elite24MVP";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Time to check in 🏀",
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
