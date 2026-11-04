/* TDL worker: installable notifications, background push, and call actions. */

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

function withQuery(target, key, value) {
  try {
    const url = new URL(target, self.location.origin);
    url.searchParams.set(key, value);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return target;
  }
}

async function notifyOpenClients(payload) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'nova:push', payload });
  }
}

/**
 * Server-sent reminders (T-30, T-10) and in-app calls. The payload is JSON:
 * { title, body, tag, requireInteraction, actions, vibrate,
 *   data: { kind, todoId, eventId, url, script, language } }
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Nova reminder';
  const isCall = payload.data?.kind === 'voice-call';
  const options = {
    body: payload.body || 'A task needs your attention.',
    tag: payload.tag || 'nova-reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || { url: '/' },
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : undefined,
    vibrate: Array.isArray(payload.vibrate)
      ? payload.vibrate
      : isCall
        ? [200, 100, 200, 100, 200]
        : undefined,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      notifyOpenClients(payload),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let target = data.url || '/';

  // Notification action buttons map onto the call overlay's actions.
  if (event.action === 'snooze') target = withQuery(target, 'action', 'snooze');
  if (event.action === 'answer') target = withQuery(target, 'action', 'answer');

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        if (typeof existing.navigate === 'function') {
          await existing.navigate(target).catch(() => {});
        }
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })()
  );
});
