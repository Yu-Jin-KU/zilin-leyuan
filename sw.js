/* 字灵乐园 Service Worker：让网站第二次打开起可以完全离线使用。
   - 核心文件（页面、字库、字体）首次访问时整体缓存；
   - 笔顺数据 data/ 和语音 audio/ 用到哪个缓存哪个（内容不变，缓存优先）；
   - index.html 走“网络优先”，这样更新后刷新就能拿到新版本。 */
const VERSION = 'zilin-v8';
const CORE = ['./', 'index.html', 'lib/hanzi-writer.min.js', 'lib/qrcode.min.js',
  'fonts/ZCOOLKuaiLe-sub.woff2', 'fonts/LXGWWenKai-sub.woff2', 'fonts/Andika-Regular-sub.woff2', 'fonts/Andika-Bold-sub.woff2',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isPage) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && (url.pathname.includes('/data/') || url.pathname.includes('/audio/') || url.pathname.includes('/music/') || url.pathname.includes('/fonts/') || url.pathname.includes('/lib/'))) {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return r;
  })));
});
