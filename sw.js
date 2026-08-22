// sw.js - Service Worker for PWA and background notifications
const CACHE_NAME = 'alagatap-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/state.js',
    '/js/share.js',
    '/js/notifications.js',
    '/js/components.js',
    '/js/utils.js',
    '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache opened');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch from cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Handle background notifications (for PWA)
self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230052CC"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">💊</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230052CC"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">💊</text></svg>',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: data.tag || 'alagatap-notification',
        data: {
            url: data.url || '/',
            medicationId: data.medicationId || null
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    const medicationId = event.notification.data?.medicationId || null;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Check if there's already a window/tab open with the target URL
                for (let client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If not, open a new window/tab
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
            .then(() => {
                // If we have a medication ID, send a message to the page to highlight it
                if (medicationId) {
                    // Wait a bit for the page to load
                    setTimeout(() => {
                        clients.matchAll({ type: 'window', includeUncontrolled: true })
                            .then(windowClients => {
                                for (let client of windowClients) {
                                    client.postMessage({
                                        type: 'HIGHLIGHT_MEDICATION',
                                        medicationId: medicationId
                                    });
                                }
                            });
                    }, 1000);
                }
            })
    );
});