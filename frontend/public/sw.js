/* TDL worker: installable notifications, background push, and click focus. */

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

/**
 * Server-sent reminders (T-30, T-10). The payload is JSON:
 * { title, body, tag, data: { todoId, eventId, url } }
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Nova reminder';
  const options = {
    body: payload.body || 'A task needs your attention.',
    tag: payload.tag || 'nova-reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || { url: '/' },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow(target);
      })
  );
});
