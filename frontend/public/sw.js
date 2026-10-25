/* TDL worker: supports installable mobile notifications and focuses the app on click. */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// A passthrough fetch handler keeps the app installable without caching stale
// API or HTML responses. Notification delivery does not depend on it.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(fetch(event.request));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow('/');
      })
  );
});
