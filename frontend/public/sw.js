/**
 * Service Worker for Web Push Notifications
 * Handles push events and notification clicks
 */

// Cache strategy for offline support
const CACHE_NAME = 'pomodoro-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ── Web Push ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const { title, body, icon, badge, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  icon  || '/icons/icon-192x192.png',
      badge: badge || '/icons/badge-72x72.png',
      data,
      actions: [
        { action: 'start_break', title: '☕ Empezar descanso' },
        { action: 'dismiss',     title: '✕ Cerrar' },
      ],
      vibrate: [200, 100, 200],
      tag:     'pomodoro-complete',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'start_break') {
    event.waitUntil(
      clients.openWindow('/?action=start_break')
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
        } else {
          clients.openWindow('/');
        }
      })
    );
  }
});
