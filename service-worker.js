
const cacheName = 'hannah-course-v3';
const staticAssets = [
  '/',
  '/index.html',
  '/CSS/styles.css',
  '/imagens/hannah_logo.png',
  '/imagens/icon-512x512.png',
  '/Formulario/login.html',
  '/Level0/index.html',
  '/Level1/index.html',
  '/Level2/index.html',
  '/Level3/index.html',
  '/Level4/index.html',
  '/offline.html'
];

self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('[SW] Armazenando em cache estático:', staticAssets);
      return cache.addAll(staticAssets);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('/Formulario/login.html')) {
    console.log('[SW] Ignorando login:', event.request.url);
    return;
  }

  console.log('[SW] Interceptando requisição:', event.request.url);

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        console.log('[SW] Servindo do cache:', event.request.url);
        return cached;
      }

      return fetch(event.request)
        .then(response => {
          return caches.open(cacheName).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          console.warn('[SW] Sem conexão. Exibindo fallback...');
          if (event.request.destination === 'document') {
            return caches.match('/offline.html');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
