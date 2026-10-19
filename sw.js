// sw.js — AlagaTap service worker
// Handles: install/activate/fetch + notification clicks.
// NOTE: iOS only shows SW notifications when the site is added to Home Screen
// (iOS 16.4+) and the browser is running. If the browser is fully closed,
// nothing fires. That is an iOS restriction, not a bug.

const CACHE = 'alagatap-v3';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Passthrough — app works online-only; caching handled by the browser.
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientsArr => {
                // Focus an existing tab if one is open
                for (const client of clientsArr) {
                    if ('focus' in client) return client.focus();
                }
                // Otherwise open a new tab
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/');
                }
            })
    );
});