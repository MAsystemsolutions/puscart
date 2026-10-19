/* Puscart offline helper.
   Keeps the app saved on the phone so it opens instantly and works without internet.
   When you upload a new index.html, change the version number below (v1 → v2) so phones update. */
const CACHE = 'puscart-v1';
const FILES = ['./', './index.html', './manifest.json', './logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // only clean up OLD Puscart copies (Kwentoink lives on the same website — leave it alone)
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.indexOf('puscart-') === 0 && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // The app page: newest version when online, saved copy when offline or very slow.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(req, { cache: 'no-store' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))
        ]);
        if (res && res.ok) { cache.put('./', res.clone()); cache.put('./index.html', res.clone()); }
        return res;
      } catch (err) {
        return (await cache.match('./')) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Logo, manifest: saved copy right away, refreshed in the background.
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(saved => {
        const fresh = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => saved);
        return saved || fresh;
      })
    )
  );
});
