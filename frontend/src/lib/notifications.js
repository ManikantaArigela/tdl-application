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

export async function showSystemNotification(title, options = {}) {
  if (typeof window === 'undefined') return false;

  try {
    const registration =
      (await navigator.serviceWorker?.getRegistration?.()) ??
      (await registerNotificationWorker());
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall back to the constructor below */
  }

  try {
    if ('Notification' in window) {
      new window.Notification(title, options);
      return true;
    }
  } catch {
    /* notifications can be blocked by the OS */
  }
  return false;
}
