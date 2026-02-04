const CACHE_NAME = 'stock-ticker-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
  // Add any other CSS or JS files you have here, e.g., '/style.css'
];

// 1. Install: Cache the app shell
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 2. Fetch: Network First, then Cache (Safe for updates)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If valid response, clone it and update cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // If offline, try the cache
        return caches.match(event.request);
      })
  );
});