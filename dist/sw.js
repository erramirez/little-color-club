/* Generated release hashes keep the offline shell together. Activation during play is deferred. */
const RELEASE = "1fcb3d0cf88fa16a";
const HASHES = {"/app.mjs":"3fd4b5e2e3dd493d47bb4828d34cb7ebee5190ef9600407ae81ddfd375e1e13f","/core.mjs":"35ac735041ac8c5a02932510e457bb333e8dc511e16d4635f26fb3999294e0e4","/index.html":"907fd091da3e900e2042f486ba7bc7b97c7108e98592e19170cc16fcec1933b6","/library.mjs":"6d6494a7d1688ee436fd3abced57016b083d95b188221b74544f37f045ae5989","/manifest.webmanifest":"222e265b42b1107eb69ad13ff3a6632615db0163b33c0227826f01992658e9e8","/puzzle-drag.mjs":"533e0bfb568984b1227bfe420e89f521f5ae837ff07458b0776b143eb8d96494","/storage.mjs":"82752f8400d8c57182e86ccc91b73ba68b755fc14204fa35a5e7595dfdd5e620","/style.css":"fc5760a6dd7f9f1d27b1c4463d780e1abbb1ca681f3b60f4d7bd18d7b7f6fae5","/sync.mjs":"c08e82bfc6b40a50be88381ca84315a2b1f6682edb9f5ca5be699e3dfc93c8e1","/textured-paint.mjs":"0b5cc2457f1c8f1e910b0a79808224fb39a8132f874185ef1a7368abaf83484f","/updates.mjs":"02c329bef13298e8161e4f459aff0b6a211af1bb54f496c8644416989b0afde7","/icons/crayons-192.png":"b9d92fa88ef03501750adb3213714c4785a5031ec0ef8ff1b3c0531f5b6d2365","/icons/crayons-512.png":"05077281c0a2f947e4143096038b5b0ab4e6e2bcaf2d65a1dc32b479a59378cd","/icons/crayons-apple.png":"83c0719abe36bdd176108aea551fdf1972028f2ea0b748c301b4c171818d4900","/icons/crayons.svg":"0b1d97de214cf0cf6d465d6925ca512bd3a2fa0b8e37d0a689d07c96763b1f0e","/icons/ui.svg":"4895c994d2081c4bb94efdb179f4d761a782733a317bc7bbf8ccdb01e344709f"};
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
