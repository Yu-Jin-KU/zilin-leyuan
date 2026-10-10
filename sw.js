/* 字灵乐园 Service Worker：让网站第二次打开起可以完全离线使用。
   - 核心文件（页面、字库、字体）首次访问时整体缓存；
   - 笔顺数据 data/ 和语音 audio/ 用到哪个缓存哪个（内容不变，缓存优先）；
   - index.html 走“网络优先”，这样更新后刷新就能拿到新版本。 */
const VERSION = 'zilin-v21';
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
  const media = url.host === 'zilin-media.zilingleyuan.workers.dev' || url.host === 'zilin-media2.zilingleyuan.workers.dev';   // 语音 / 绘本图片和旁白的托管域
  if (e.request.method !== 'GET' || (url.origin !== location.origin && !media)) return;
  const isPage = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isPage) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && (media || url.pathname.includes('/data/') || url.pathname.includes('/audio/') || url.pathname.includes('/music/') || url.pathname.includes('/fonts/') || url.pathname.includes('/lib/'))) {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return r;
  })));
});

/* 用量提醒（只有在老师页开启过推送的设备会收到）：推送没有正文，收到后去云端取今天的数字再显示 */
const SYNC_API = 'https://zilin-sync.zilingleyuan.workers.dev';
self.addEventListener('push', e => {
  e.waitUntil(fetch(SYNC_API + '/usage').then(r => r.json()).then(u =>
    self.registration.showNotification(`字灵乐园：云端请求已用 ${u.pct}%`, { body: `今天约 ${u.est.toLocaleString('en-US')} / ${u.limit.toLocaleString('en-US')} 次（UTC 零点重置）。到 100% 后新的进度备份会暂停，孩子照常能玩。`, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'zilin-usage', data: { url: 'teacher.html' } })
  ).catch(() => self.registration.showNotification('字灵乐园：用量提醒', { body: '云端请求快到免费额度了，打开老师页看看。', icon: 'icon-192.png', tag: 'zilin-usage', data: { url: 'teacher.html' } })));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow((e.notification.data && e.notification.data.url) || './')); });
