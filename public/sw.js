const CACHE_NAME = 'krc-pm-v1';
const OFFLINE_QUEUE_KEY = 'krc-pm-offline-queue';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
];

// Install - cache core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(['/index.html']))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - serve from cache when offline
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Let Supabase requests pass through (handle offline in app)
  if (url.hostname.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
  );
});

// Listen for sync events to flush offline queue
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-reports') {
    e.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Notify all clients to sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
}
