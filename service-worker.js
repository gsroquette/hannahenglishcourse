const cacheName = 'hannah-course-v2';
const staticAssets = [
  '/',
  '/index.html',
  '/CSS/styles.css',
  '/imagens/hannah_logo.png',
  '/imagens/icon-192x192.png',
  '/imagens/icon-512x512.png',
  '/Formulario/login.html',
  '/Level0/index.html',
  '/Level1/index.html',
  '/Level2/index.html',
  '/Level3/index.html',
  '/Level4/index.html',
  '/offline.html'
];

// Instala o service worker e faz cache dos arquivos estáticos
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('[SW] Armazenando em cache estático:', staticAssets);
      return cache.addAll(staticAssets);
    })
  );
  self.skipWaiting(); // ativa imediatamente
});

// Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== cacheName)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Intercepta as requisições
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // ⚠️ Evita interferir no login
  if (event.request.url.includes('/Formulario/login.html')) {
    console.log('[SW] Ignorando cache para login:', event.request.url);
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
          console.log('[SW] Requisição bem-sucedida. Cacheando dinamicamente:', event.request.url);
          return caches.open(cacheName).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(error => {
          console.warn('[SW] Falha na rede. Tentando fallback offline.html:', event.request.url);
          return caches.match('/offline.html');
        });
    })
  );
});
