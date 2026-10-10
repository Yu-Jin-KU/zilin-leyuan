/* 字灵乐园 · 云端后端（Cloudflare Worker + D1）

   家庭码（家长用，自动生成）
   POST /new                    -> {code}            新建一个家庭码（8 位，去掉易混字母）
   GET  /f/:code                -> {data, updated}   取回这个家庭的进度
   PUT  /f/:code  body          -> {data, updated}   上传并合并（每个字取最高星，名字以最新为准）
   data 只有 { 玩家id: { name, prog:{字:星} } }，不存画作，不存任何联系方式。

   教师版（见 teacher.html）
   POST /c/new {name, invite}   -> {code, key, name} 新建班级（invite 须等于 secret TEACHER_INVITE，否则 403）：班级码发给家长，老师钥匙只有老师留着
   GET  /c/:code                -> {name, assign}    学生端取班级名和本周生字（只要班级码）
   PUT  /c/:code/members {fam, players}              学生设备把加入了这个班的名字和进度汇总上来（每个字取最高星）
   GET  /c/:code/report?key=K   -> {name, code, assign, members:[{id,name,prog,updated}]}
   PUT  /c/:code/assign?key=K {chars, note}          老师布置本周生字
   DELETE /c/:code/m/:id?key=K                       老师把一个名字从班里移除
   GET  /c/:code                同时返回 roster（老师预先录的名单 [{id,name,en}]），家长加入时从名单里选孩子
   PUT  /c/:code/roster?key=K {roster:[{id,name,en}]}  老师录名单；学生端上传时每个名字带 rid（名单里的 id），报告按名单合并多台设备
   GET  /yt                     -> 频道全部视频 {videos:[{id,title}]}（抓频道页 + 翻页，缓存 1 小时）
   GET  /stats                  -> 全站汇总：家庭数、1/7/30 天活跃、班级数、班里学生数（只有数字）
   GET  /usage                  -> {day, est, limit, pct} 今天（UTC）这个 Worker 估计处理了多少请求（免费档每天 10 万）
   GET  /usage/test?key=邀请码   -> 发一条测试提醒（看通知通不通）
   GET  /push/key               -> Web Push 的 VAPID 公钥
   POST /push/sub?key=邀请码 {sub} -> 订阅用量提醒（浏览器推送） */
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
function newCode(n = 8) { const a = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (const b of a) s += ALPH[b % ALPH.length]; return s; }
function cleanRoster(r) {
  if (!Array.isArray(r)) return [];
  const out = []; const seen = new Set();
  for (const it of r.slice(0, 60)) {
    const id = String((it && it.id) || '').replace(/[^\w-]/g, '').slice(0, 20) || ('r' + (out.length + 1));
    if (seen.has(id)) continue; seen.add(id);
    out.push({ id, name: String((it && it.name) || '').trim().slice(0, 16), en: String((it && it.en) || '').trim().slice(0, 30) });
  }
  return out.filter(x => x.name);
}
function cleanProg(prog) {
  const out = {};
  for (const [c, f] of Object.entries(prog || {})) { if (typeof c === 'string' && c.length <= 4) { const n = f | 0; if (n >= 1 && n <= 3) out[c] = n; } }
  return out;
}
function clean(players) {
  const out = {}; if (!players || typeof players !== 'object') return out;
  for (const [id, p] of Object.entries(players).slice(0, 60)) {
    if (!/^[\w-]{1,32}$/.test(id) || !p || typeof p !== 'object') continue;
    out[id] = { name: String(p.name || '').slice(0, 16), prog: cleanProg(p.prog), rid: String(p.rid || '').replace(/[^\w-]/g, '').slice(0, 20) };
  }
  return out;
}
function mergeProg(a, b) { const out = { ...a }; for (const [c, f] of Object.entries(b)) out[c] = Math.max(out[c] || 0, f); return out; }
function merge(base, inc) {
  const out = { ...base };
  for (const [id, p] of Object.entries(inc)) {
    const q = out[id] ? { name: out[id].name, prog: { ...out[id].prog } } : { name: p.name, prog: {} };
    if (p.name) q.name = p.name;
    q.prog = mergeProg(q.prog, p.prog);
    out[id] = q;
  }
  return out;
}
async function readJson(req, max = 300000) {
  const body = await req.text();
  if (body.length > max) throw new Error('too big');
  return JSON.parse(body);
}

async function family(req, env, url) {
  if (url.pathname === '/new' && req.method === 'POST') {
    for (let i = 0; i < 5; i++) {
      const c = newCode();
      try { await env.DB.prepare('INSERT INTO fam(code,data,updated,created) VALUES(?1,?2,?3,?3)').bind(c, '{}', Date.now()).run(); return json({ code: c }); } catch (_) {}
    }
    return json({ error: 'retry' }, 500);
  }
  const m = url.pathname.match(/^\/f\/([A-Z2-9]{8})$/);
  if (!m) return json({ error: 'not found' }, 404);
  const code = m[1];
  if (req.method === 'GET') {
    const r = await env.DB.prepare('SELECT data,updated FROM fam WHERE code=?1').bind(code).first();
    if (!r) return json({ error: 'no such code' }, 404);
    return json({ data: JSON.parse(r.data), updated: r.updated });
  }
  if (req.method === 'PUT') {
    let inc; try { inc = clean(await readJson(req)); } catch (_) { return json({ error: 'bad json' }, 400); }
    const r = await env.DB.prepare('SELECT data FROM fam WHERE code=?1').bind(code).first();
    if (!r) return json({ error: 'no such code' }, 404);
    const merged = merge(JSON.parse(r.data), inc); const now = Date.now();
    await env.DB.prepare('UPDATE fam SET data=?2,updated=?3 WHERE code=?1').bind(code, JSON.stringify(merged), now).run();
    return json({ data: merged, updated: now });
  }
  return json({ error: 'method' }, 405);
}

const CHARS = s => [...String(s || '')].filter(ch => /[一-鿿]/.test(ch) || /^[a-zü]+$/.test(ch)).slice(0, 60);
function cleanAssign(a) {
  const chars = Array.isArray(a && a.chars) ? [...new Set(a.chars.map(String).filter(c => c.length <= 4))].slice(0, 60) : [];
  return { chars, note: String((a && a.note) || '').slice(0, 200), updated: Date.now() };
}

async function classes(req, env, url) {
  if (url.pathname === '/c/new' && req.method === 'POST') {
    let b; try { b = await readJson(req, 2000); } catch (_) { return json({ error: 'bad json' }, 400); }
    if (env.TEACHER_INVITE && String((b && b.invite) || '').trim() !== env.TEACHER_INVITE) return json({ error: 'invite' }, 403);   // 老师版暂不公开：建班要邀请码（wrangler secret TEACHER_INVITE）
    const name = String((b && b.name) || '').trim().slice(0, 30) || '我的班';
    for (let i = 0; i < 5; i++) {
      const code = newCode(8), key = newCode(16);
      try { await env.DB.prepare('INSERT INTO cls(code,key,name,assign,updated,created) VALUES(?1,?2,?3,?4,?5,?5)').bind(code, key, name, '{}', Date.now()).run(); return json({ code, key, name }); } catch (_) {}
    }
    return json({ error: 'retry' }, 500);
  }
  const m = url.pathname.match(/^\/c\/([A-Z2-9]{8})(?:\/(members|report|assign|roster|m\/([\w.-]{1,50})))?$/);
  if (!m) return json({ error: 'not found' }, 404);
  const code = m[1], sub = m[2] || '', mid = m[3];
  const cls = await env.DB.prepare('SELECT code,key,name,assign,roster FROM cls WHERE code=?1').bind(code).first();
  if (!cls) return json({ error: 'no such class' }, 404);
  const assign = JSON.parse(cls.assign || '{}'); const roster = JSON.parse(cls.roster || '[]');

  if (!sub && req.method === 'GET') return json({ name: cls.name, assign, roster: roster.map(r => ({ id: r.id, name: r.name })) });

  if (sub === 'members' && req.method === 'PUT') {
    let b; try { b = await readJson(req); } catch (_) { return json({ error: 'bad json' }, 400); }
    const fam = String((b && b.fam) || ''); if (!/^[A-Z2-9]{8}$/.test(fam)) return json({ error: 'bad fam' }, 400);
    const players = clean(b.players); const now = Date.now(); let n = 0;
    const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM mem WHERE cls=?1').bind(code).first();
    for (const [pid, p] of Object.entries(players)) {
      const id = fam + '.' + pid;
      const old = await env.DB.prepare('SELECT prog FROM mem WHERE cls=?1 AND id=?2').bind(code, id).first();
      if (!old && (cnt.n + n) >= 60) break;
      const prog = old ? mergeProg(JSON.parse(old.prog), p.prog) : p.prog;
      await env.DB.prepare('INSERT INTO mem(cls,id,name,prog,updated,rid) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(cls,id) DO UPDATE SET name=excluded.name,prog=excluded.prog,updated=excluded.updated,rid=excluded.rid')
        .bind(code, id, p.name || '?', JSON.stringify(prog), now, p.rid || '').run();
      n++;
    }
    return json({ ok: true, n, name: cls.name, assign, roster: roster.map(r => ({ id: r.id, name: r.name })) });
  }

  // 下面的都要老师钥匙
  const key = url.searchParams.get('key') || '';
  if (key !== cls.key) return json({ error: 'wrong key' }, 403);

  if (sub === 'report' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT id,name,prog,updated,rid FROM mem WHERE cls=?1 ORDER BY updated DESC').bind(code).all()).results || [];
    return json({ name: cls.name, code, assign, roster, members: rows.map(r => ({ id: r.id, name: r.name, prog: JSON.parse(r.prog), updated: r.updated, rid: r.rid || '' })) });
  }
  if (sub === 'roster' && req.method === 'PUT') {
    let b; try { b = await readJson(req, 20000); } catch (_) { return json({ error: 'bad json' }, 400); }
    const r = cleanRoster(b && b.roster);
    await env.DB.prepare('UPDATE cls SET roster=?2,updated=?3 WHERE code=?1').bind(code, JSON.stringify(r), Date.now()).run();
    return json({ roster: r });
  }
  if (sub === 'assign' && req.method === 'PUT') {
    let b; try { b = await readJson(req, 5000); } catch (_) { return json({ error: 'bad json' }, 400); }
    const a = cleanAssign(b);
    await env.DB.prepare('UPDATE cls SET assign=?2,updated=?3 WHERE code=?1').bind(code, JSON.stringify(a), a.updated).run();
    return json({ assign: a });
  }
  if (mid && req.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM mem WHERE cls=?1 AND id=?2').bind(code, mid).run();
    return json({ ok: true });
  }
  return json({ error: 'method' }, 405);
}

/* 频道视频列表（给绘本 / 古诗页面自动补链接）：抓 YouTube 频道页的 ytInitialData，再用页面里的 innertube key 翻页。
   GET /yt -> {videos:[{id,title}], at}   缓存 1 小时 */
const YT_CHANNEL = 'UC6JD2Ej48LIp_iLkkFN6Xqg';
function* walk(o) { if (o && typeof o === 'object') { yield o; for (const v of Object.values(o)) yield* walk(v); } }
function pickVideos(data, out, seen) {
  let cont = null;
  for (const o of walk(data)) {
    if (o.videoRenderer && o.videoRenderer.videoId) {
      const vr = o.videoRenderer; const id = vr.videoId; if (seen.has(id)) continue; seen.add(id);
      const title = (vr.title && vr.title.runs && vr.title.runs.map(r => r.text).join('')) || '';
      out.push({ id, title });
    }
    if (o.continuationItemRenderer && o.continuationItemRenderer.continuationEndpoint && o.continuationItemRenderer.continuationEndpoint.continuationCommand) cont = o.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
  }
  return cont;
}
async function ytVideos() {
  const cache = caches.default; const key = new Request('https://zilin-sync.cache/yt/' + YT_CHANNEL);
  const hit = await cache.match(key); if (hit) return hit;
  // 先用公开的 RSS（最近 15 条，不会被 Google 的机器人拦截）；频道页抓取只作补充
  try {
    const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`, { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
    const ids = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map(m => m[1]);
    const titles = [...xml.matchAll(/<media:title>([^<]*)<\/media:title>/g)].map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
    if (ids.length) {
      const res = new Response(JSON.stringify({ videos: ids.map((id, i) => ({ id, title: titles[i] || '' })), source: 'rss', at: Date.now() }), { headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
      await cache.put(key, res.clone()); return res;
    }
  } catch (_) {}
  const html = await (await fetch(`https://www.youtube.com/channel/${YT_CHANNEL}/videos?hl=zh-CN`, { headers: { 'accept-language': 'zh-CN,zh;q=0.9', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', 'cookie': 'CONSENT=YES+1; SOCS=CAI' } })).text();
  const m = html.match(/ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s) || html.match(/ytInitialData\s*=\s*(\{.*?\});/s); if (!m) return json({ error: 'no data', len: html.length, head: html.slice(0, 400), consent: /consent/i.test(html) }, 502);
  const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1]; const ver = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20240101.00.00';
  const out = [], seen = new Set(); let cont = pickVideos(JSON.parse(m[1]), out, seen);
  for (let i = 0; cont && apiKey && i < 12; i++) {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0', 'x-youtube-client-name': '1', 'x-youtube-client-version': ver },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: ver, hl: 'zh-CN', gl: 'DK' } }, continuation: cont }) });
    if (!r.ok) break;
    cont = pickVideos(await r.json(), out, seen);
  }
  const res = new Response(JSON.stringify({ videos: out, at: Date.now() }), { headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  await cache.put(key, res.clone()); return res;
}

/* 免费额度预警：Workers 免费档每天 10 万次请求（UTC 日界，含预检请求和 cron）。每个请求有 1/50 的概率在 D1 表 usage 里记 50 次（抽样估算，
   不给数据库添负担）；cron 每 30 分钟算一次百分比，到 60% / 90% / 100% 各提醒一次。提醒走 ntfy.sh：手机装 ntfy 订阅 secret NTFY_TOPIC 就有推送，
   设了 secret ALERT_EMAIL 的话同时发邮件。超额后新的同步请求会失败，孩子照常能玩，只是进度暂时不备份；升级 Workers 付费版每月 5 美元含 1000 万次。 */
const DAILY_LIMIT = 100000, SAMPLE = 50;
const today = () => new Date().toISOString().slice(0, 10);
async function countReq(env) {
  if (Math.random() * SAMPLE >= 1) return;
  await env.DB.prepare('INSERT INTO usage(day,n,alerted) VALUES(?1,?2,0) ON CONFLICT(day) DO UPDATE SET n=n+?2').bind(today(), SAMPLE).run();
}
async function usageToday(env) {
  const r = await env.DB.prepare('SELECT n, alerted FROM usage WHERE day=?1').bind(today()).first();
  const est = (r && r.n) || 0; return { day: today(), est, limit: DAILY_LIMIT, pct: Math.round(est / DAILY_LIMIT * 100), alerted: (r && r.alerted) || 0 };
}
async function notify(env, title, message) {
  if (!env.NTFY_TOPIC) return false;
  const body = { topic: env.NTFY_TOPIC, title, message, priority: 4, tags: ['warning'] };
  if (env.ALERT_EMAIL) body.email = env.ALERT_EMAIL;
  const r = await fetch('https://ntfy.sh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  notify.last = r.status + ' ' + (await r.text()).slice(0, 120);
  return r.ok;
}
/* Web Push（VAPID）：secret VAPID_PRIVATE_JWK（私钥 JWK）、VAPID_PUBLIC（公钥 raw base64url）。只发空正文，
   页面的 sw 收到后自己去 /usage 取数字显示，省掉正文加密。订阅存 D1 表 push(id, sub, created)。 */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8 = t => new TextEncoder().encode(t);
async function vapidAuth(env, endpoint) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://ziling.danpicbook.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(head + '.' + claims));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}
async function sendPush(env) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return 0;
  const rows = (await env.DB.prepare('SELECT id, sub FROM push').all()).results || [];
  let ok = 0;
  for (const row of rows) {
    try {
      const sub = JSON.parse(row.sub);
      const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(env, sub.endpoint), TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) await env.DB.prepare('DELETE FROM push WHERE id=?1').bind(row.id).run();
      else if (r.ok) ok++;
    } catch (_) {}
  }
  return ok;
}
async function checkUsage(env, force) {
  const u = await usageToday(env);
  const level = u.pct >= 100 ? 3 : u.pct >= 90 ? 2 : u.pct >= 60 ? 1 : 0;
  if (!force && level <= u.alerted) return { ...u, sent: false };
  const title = level >= 3 ? '字灵乐园：今天的免费请求已用完' : level === 2 ? '字灵乐园：免费请求已用到 90%' : level === 1 ? '字灵乐园：免费请求已用到 60%' : '字灵乐园：用量提醒测试';
  const message = `今天（UTC ${u.day}）云端备份 Worker 估计已处理 ${u.est.toLocaleString('en-US')} 次请求，免费额度每天 ${DAILY_LIMIT.toLocaleString('en-US')} 次，已用 ${u.pct}%。` +
    (level ? '超过以后到 UTC 午夜之前新的同步会失败，孩子照常能玩，只是进度暂时不备份。该考虑发通知、准备收费或升级 Workers 付费版（每月 5 美元，含 1000 万次）了。' : '这是一条测试，说明通知链路是通的。');
  const pushed = await sendPush(env);   // 浏览器推送（ntfy.sh 从 Worker 连不上，不用了；title / message 留给以后的邮件通道）
  const ok = pushed > 0; void title; void message;
  if (ok && level > u.alerted) await env.DB.prepare('UPDATE usage SET alerted=?2 WHERE day=?1').bind(u.day, level).run();
  return { ...u, sent: ok, pushed };
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(checkUsage(env, false).catch(() => {})); },
  async fetch(req, env, ctx) {
    try { ctx.waitUntil(countReq(env).catch(() => {})); } catch (_) {}
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/usage' && req.method === 'GET') { const u = await usageToday(env); delete u.alerted; return new Response(JSON.stringify(u), { headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } }); }
      if (url.pathname === '/usage/test' && req.method === 'GET') { if (!env.TEACHER_INVITE || url.searchParams.get('key') !== env.TEACHER_INVITE) return json({ error: 'key' }, 403); return json({ ...(await checkUsage(env, true)), devices: (await env.DB.prepare('SELECT COUNT(*) n FROM push').first()).n }); }
      if (url.pathname === '/push/key' && req.method === 'GET') return json({ key: env.VAPID_PUBLIC || null });
      if (url.pathname === '/push/sub' && req.method === 'POST') {   // 只有知道邀请码的人（作者 / 老师）能订阅用量提醒
        if (!env.TEACHER_INVITE || url.searchParams.get('key') !== env.TEACHER_INVITE) return json({ error: 'key' }, 403);
        const b = await req.json().catch(() => null); const sub = b && b.sub;
        if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) return json({ error: 'sub' }, 400);
        const id = b64u(await crypto.subtle.digest('SHA-256', utf8(sub.endpoint))).slice(0, 24);
        await env.DB.prepare('INSERT INTO push(id,sub,created) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET sub=?2').bind(id, JSON.stringify(sub).slice(0, 4000), Date.now()).run();
        return json({ ok: true, devices: (await env.DB.prepare('SELECT COUNT(*) n FROM push').first()).n });
      }
      if (url.pathname === '/yt' && req.method === 'GET') return await ytVideos();
      if (url.pathname === '/stats' && req.method === 'GET') {   // 只给汇总数字，不含任何个人信息
        const now = Date.now(), d1 = now - 864e5, d7 = now - 7 * 864e5, d30 = now - 30 * 864e5;
        const f = await env.DB.prepare('SELECT COUNT(*) n, SUM(updated>?1) d1, SUM(updated>?2) d7, SUM(updated>?3) d30, SUM(created>?2) new7 FROM fam').bind(d1, d7, d30).first();
        const c = await env.DB.prepare('SELECT COUNT(*) n FROM cls').first();
        const m = await env.DB.prepare('SELECT COUNT(*) n, SUM(updated>?1) d7 FROM mem').bind(d7).first();
        return new Response(JSON.stringify({ families: f.n, active_1d: f.d1 || 0, active_7d: f.d7 || 0, active_30d: f.d30 || 0, new_7d: f.new7 || 0, classes: c.n, students_in_classes: m.n, students_active_7d: m.d7 || 0 }),
          { headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
      }
      if (url.pathname.startsWith('/c/')) return await classes(req, env, url);
      return await family(req, env, url);
    } catch (e) { return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
  }
};
