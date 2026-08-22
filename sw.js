// sw.js - Service Worker (for PWA only, no OneSignal)
// This is just a placeholder for PWA functionality

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('Offline', { status: 503 });
        })
    );
});