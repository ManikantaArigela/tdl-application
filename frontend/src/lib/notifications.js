/**
 * System notifications for browsers.
 *
 * Android Chrome only supports notifications through a service worker
 * registration, so prefer `showNotification` and fall back to the constructor
 * for desktop browsers without a worker.
 */

let registrationPromise = null;

export function registerNotificationWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .catch(() => null);
  }
  return registrationPromise;
}

/** VAPID keys are URL-safe base64; PushManager wants a Uint8Array. */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

/**
 * Registers a background push subscription. Returns null when the browser
 * cannot deliver push (no service worker, permission denied, unsupported).
 */
export async function subscribeToPush(publicKey) {
  if (typeof window === 'undefined' || !publicKey) return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const registration = await registerNotificationWorker();
  if (!registration) return null;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function currentPushSubscription() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function showSystemNotification(title, options = {}) {
  if (typeof window === 'undefined') return false;

  const payload = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    ...options,
  };

  try {
    const registration =
      (await navigator.serviceWorker?.getRegistration?.()) ??
      (await registerNotificationWorker());
    if (registration?.showNotification) {
      await registration.showNotification(title, payload);
      return true;
    }
  } catch {
    /* fall back to the constructor below */
  }

  try {
    if ('Notification' in window) {
      new window.Notification(title, payload);
      return true;
    }
  } catch {
    /* notifications can be blocked by the OS */
  }
  return false;
}
