/* Мурноматика — service worker
   Кэширует приложение и шрифты при первом визите,
   затем работает полностью без интернета.

   ВАЖНО: при каждом обновлении index.html повышайте
   версию кэша (v2 → v3 → v4…), иначе у установивших
   PWA пользователей останется старая версия. */

const CACHE_NAME = 'murnomatika-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png'
];

/* Установка: кэшируем оболочку приложения */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* Активация: чистим старые кэши */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Перехват запросов:
   — шрифты Google: cache-first (скачали один раз — работает офлайн)
   — навигация: network-first, офлайн → отдаём кэш
   — остальное: cache-first */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Google Fonts: кэшируем навсегда */
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  /* Навигация (открытие страницы): сеть → кэш */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('./index.html').then(r => r || caches.match('./'))
      )
    );
    return;
  }

  /* Статика: кэш → сеть */
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(resp => {
        if (resp.ok && url.origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return resp;
      })
    )
  );
});
