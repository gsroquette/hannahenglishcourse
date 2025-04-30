const cacheName = 'hannah-course-v4';
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

  const requestURL = new URL(event.request.url);
  let requestToMatch = event.request;

  // Redireciona /LevelX/ para /LevelX/index.html
  if (requestURL.pathname.endsWith('/')) {
    requestToMatch = new Request(requestURL.pathname + 'index.html', {
      method: event.request.method,
      headers: event.request.headers,
      mode: event.request.mode,
      credentials: event.request.credentials,
      redirect: event.request.redirect
    });
  }

  console.log('[SW] Interceptando:', requestToMatch.url);

  // ⚠️ FORÇA A EXIBIÇÃO DO OFFLINE.HTML QUANDO ESTIVER OFFLINE
  if (!self.navigator.onLine) {
    console.warn('[SW] Dispositivo offline — exibindo fallback');
    const acceptsHTML = event.request.headers.get('accept')?.includes('text/html');
    if (acceptsHTML) {
      event.respondWith(caches.match('/offline.html'));
    } else {
      event.respondWith(new Response('', { status: 503, statusText: 'Offline' }));
    }
    return;
  }

  // ONLINE: buscar e cachear
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return caches.open(cacheName).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        console.warn('[SW] Erro na rede. Fallback para offline.html se for HTML');
        const acceptsHTML = event.request.headers.get('accept')?.includes('text/html');
        if (acceptsHTML) {
          return caches.match('/offline.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      })
  );
});
