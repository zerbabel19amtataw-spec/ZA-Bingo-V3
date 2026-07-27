const CACHE_NAME = 'za-bingo-v3-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/firebase.js',
  '/utils.js',
  '/auth.js',
  '/profile.js',
  '/wallet.js',
  '/rooms.js',
  '/game.js',
  '/leaderboard.js',
  '/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    }).catch(() => {
      // Return offline page or cached version
      return caches.match('/index.html');
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
