const CACHE_VERSION = 'epu-tervis-v10';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/utils.js',
  './js/charts.js',
  './js/nutrition.js',
  './js/workouts.js',
  './js/gymplans.js',
  './js/measurements.js',
  './js/cycle.js',
  './js/water.js',
  './js/steps.js',
  './js/photos.js',
  './js/finance.js',
  './js/settings.js',
  './js/weekly.js',
  './js/progress.js',
  './js/dashboard.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Käsitsi sisestatavad andmed elavad localStorage'is, mitte siin —
// see cache hoiab ainult äpi enda koodi/varasid, et see töötaks ka ilma internetita.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});
