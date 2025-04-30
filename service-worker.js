const cacheName = 'hannah-course-v2';
const staticAssets = [
  '/',
  '/index.html',
  '/CSS/styles.css',
  '/imagens/hannah_logo.png',
  '/imagens/icon-192x192.png',
  '/imagens/icon-512x512.png',
  '/Formulario/login.html',
  '/nivelA/index.html',
  '/nivelB/index.html',
  '/nivelC/index.html',
  '/nivelD/index.html',
  '/offline.html' // Página que você pode criar para mostrar quando offline
];

// Instala o service worker e faz cache dos arquivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(staticAssets);
    })
  );
  self.skipWaiting(); // ativa imediatamente
});

// Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // assume controle imediato
});

// Responde às requisições
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request)
        .then(response => {
          // Cache dinâmico para imagens e outros
          return caches.open(cacheName).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Se estiver offline e não achou em cache
          if (event.request.destination === 'document') {
            return caches.match('/offline.html');
          }
        });
    })
  );
});
