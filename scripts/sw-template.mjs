/* Generated release hashes keep the offline shell together. Activation during play is deferred. */
const RELEASE = __RELEASE__;
const HASHES = __HASHES__;
const SHELL = 'little-color-club-shell-' + RELEASE;
const IMAGES = 'little-color-club-images-' + RELEASE;
const shellPath = url => url.pathname.endsWith('/') ? '/index.html' : url.pathname;
self.addEventListener('install', event => event.waitUntil((async () => {
  const entries = await Promise.all(Object.entries(HASHES).map(async ([path, expected]) => {
    const response = await fetch(path, {cache: 'reload'});
    if (!response.ok) throw new Error('Incomplete app release');
    const bytes = await response.clone().arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const actual = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    // Hosting can inject HTML; its release marker must still match the cached modules.
    if(path==='/index.html'&&!(await response.clone().text()).includes('name="color-club-release" content="'+RELEASE+'"'))throw new Error('Mixed HTML release');
    if (path !== '/index.html' && actual !== expected) throw new Error('Mixed app release');
    return [path, response];
  }));
  const cache = await caches.open(SHELL);
  await Promise.all(entries.map(([path, response]) => cache.put(path, response)));
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'APPLY_UPDATE' || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    // Never force another tab or Home Screen window onto a different release.
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    if (windows.length !== 1 || windows[0].id !== event.source?.id) {
      event.ports[0].postMessage('OTHER_WINDOWS');
      return;
    }
    event.ports[0].postMessage('UPDATING');
    await self.skipWaiting();
  })());
});
self.addEventListener('activate' , event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('little-color-club-') && ![SHELL, IMAGES].includes(k)).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
async function cacheImage(request) {
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 3000);
  try {
    const response = await fetch(request, {signal: abort.signal});
    if (response.ok) try {
      const cache = await caches.open(IMAGES);
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 100)).map(k => cache.delete(k)));
    } catch { /* A full cache must not hide a successfully downloaded image. */ }
    return response;
  } finally {clearTimeout(timeout);}
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) return;
  if (event.request.mode === 'navigate' || HASHES[shellPath(url)]) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return await cache.match(event.request.mode === 'navigate' ? '/index.html' : shellPath(url)) || fetch(event.request);
    })());
  } else if (url.pathname.startsWith('/pages/') || url.pathname === '/.netlify/images') {
    event.respondWith((async () => {
      const cached = await (await caches.open(IMAGES)).match(event.request);
      if (cached) return cached;
      try {return await cacheImage(event.request);}
      catch {return new Response('Connect to open this picture', {status: 503});}
    })());
  }
});
