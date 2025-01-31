const cacheName = 'hannah-course-v1';
const assetsToCache = [
  '/',
  '/index.html',
  '/CSS/styles.css', // Ajuste conforme o nome exato do arquivo CSS
  '/imagens/hannah_logo.png',
  '/imagens/icon-192x192.png',
  '/imagens/icon-512x512.png',
  '/Formulario/login.html', // Inclua outras páginas necessárias para o funcionamento offline
  '/nivelA/index.html',
  '/nivelB/index.html',
  '/nivelC/index.html',
  '/nivelD/index.html'
];

// Evento de instalação: Armazena em cache os arquivos essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Evento de ativação: Remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
});

// Evento de fetch: Serve recursos do cache quando disponíveis
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
