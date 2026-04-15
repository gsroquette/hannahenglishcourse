const cacheName = 'hannah-course-v6';
const staticAssets = [
  '/',
  '/index.html',
  '/CSS/styles.css',
  '/manifest.json',
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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(cacheName).then(async cache => {
      console.log('[SW] Armazenando em cache estático:', staticAssets);

      const resultados = await Promise.allSettled(
        staticAssets.map(asset => cache.add(asset))
      );

      resultados.forEach((resultado, index) => {
        if (resultado.status === 'rejected') {
          console.warn('[SW] Falha ao adicionar no cache:', staticAssets[index], resultado.reason);
        }
      });
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
    }).then(() => self.clients.claim())
  );
});

// Função utilitária para detectar se é uma navegação HTML
function isHTMLRequest(request) {
  return request.headers.get('accept')?.includes('text/html');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const request = event.request;

  // Ignorar origens externas
  if (url.origin !== self.location.origin) return;

  // Ignorar login (sensível)
  if (url.pathname.includes('/Formulario/login.html')) {
    console.log('[SW] Ignorando cache de login:', url.href);
    event.respondWith(fetch(request));
    return;
  }

  // Manifest: tratar diretamente
  if (url.pathname.endsWith('manifest.json')) {
    console.log('[SW] Tratando manifest.json');
    event.respondWith(
      fetch(request).catch(() => caches.match('/manifest.json'))
    );
    return;
  }

  // Redirecionar diretórios para index.html
  let finalRequest = request;
  if (url.pathname.endsWith('/')) {
    finalRequest = new Request(url.pathname + 'index.html', {
      headers: request.headers
    });
  }

  console.log('[SW] Interceptando:', finalRequest.url);

  // Estratégia principal: tentar rede primeiro e usar cache/fallback se falhar
  event.respondWith(
    fetch(finalRequest)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          return caches.open(cacheName).then(cache => {
            cache.put(finalRequest, response.clone());
            return response;
          });
        }
        return response;
      })
      .catch(() => {
        console.warn('[SW] Falha na rede. Verificando cache/fallback.');
        return caches.match(finalRequest).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }

          if (isHTMLRequest(finalRequest)) {
            return caches.match('/offline.html').then(offlineResponse => {
              return offlineResponse || new Response('Offline', {
                status: 503,
                statusText: 'Offline',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            });
          }

          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});