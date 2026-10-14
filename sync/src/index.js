/* 字灵乐园 · 云端后端（Cloudflare Worker + D1）

   家庭码（家长用，自动生成）
   POST /new                    -> {code}            新建一个家庭码（8 位，去掉易混字母）
   GET  /f/:code                -> {data, updated}   取回这个家庭的进度
   PUT  /f/:code  body          -> {data, updated}   上传并合并（每个字取最高星，名字以最新为准）
   DELETE /f/:code/p/:pid       -> {ok}             家长删掉一个名字：云端备份和班级汇总里一起删；data._del 记墓碑，别的设备再传也不会复活
   data 只有 { 玩家id: { name, prog:{字:星} } }，不存画作，不存任何联系方式（家长自愿留的邮箱单独存在 subs 表，和家庭码不关联）。

   教师版（见 teacher.html）
   POST /c/new {name, invite}   -> {code, key, name} 新建班级（invite 须等于 secret TEACHER_INVITE，否则 403）：班级码发给家长，老师钥匙只有老师留着
   GET  /c/:code                -> {name, assign}    学生端取班级名和本周生字（只要班级码）
   PUT  /c/:code/members {fam, players}              学生设备把加入了这个班的名字和进度汇总上来（每个字取最高星）
   GET  /c/:code/report?key=K   -> {name, code, assign, members:[{id,name,prog,updated}]}
   PUT  /c/:code/assign?key=K {chars, note}          老师布置本周生字
   DELETE /c/:code/m/:id?key=K                       老师把一个名字从班里移除
   使用统计 / 意见箱 / 作者后台（2026-10-14，建表脚本 schema_act.sql）
   每个名字带 st = {w:{字:写完次数}, t:{内容:秒}, f:{功能:次数}}，跟着 PUT /f/:code 和 PUT /c/:code/members 上来，取两边较大的数合并
   PUT /f/:code?src=xxx         顺带记这个家庭最早从哪个推广链接来（只记第一次）
   POST /fb {text, contact, lang, src, where} -> {ok}   意见箱：contact 可不填
   GET  /admin?key=邀请码        -> {fams:[...], tot:{w,t,f}, n}  作者后台：每个家庭的名字、来源、进度、时长，全站最常用的内容和功能
   GET  /fb/list?key=邀请码      -> {fb:[...]}
   POST /c/:code/leave {fam, pid}                    家长在「家长看这里」点「退出」：凭家庭码删掉班里这个孩子的记录（老师那边也看不到了）
   GET  /c/:code                同时返回 roster（老师预先录的名单 [{id,name,en}]），家长加入时从名单里选孩子
   PUT  /c/:code/roster?key=K {roster:[{id,name,en}]}  老师录名单；学生端上传时每个名字带 rid（名单里的 id），报告按名单合并多台设备
   GET  /yt                     -> 频道全部视频 {videos:[{id,title}]}（抓频道页 + 翻页，缓存 1 小时）
   GET  /stats                  -> 全站汇总：家庭数、1/7/30 天活跃、班级数、班里学生数（只有数字）
   GET  /usage                  -> {day, est, limit, pct} 今天（UTC）这个 Worker 估计处理了多少请求（免费档每天 10 万）
   GET  /usage/test?key=邀请码   -> 发一条测试提醒（看通知通不通）
   GET  /push/key               -> Web Push 的 VAPID 公钥
   POST /push/sub?key=邀请码 {sub} -> 订阅用量提醒（浏览器推送）

   渠道统计 / 家长邮箱（2026-10-13，建表脚本 schema_src.sql、schema_subs.sql）
   POST /src?from=xxx           -> {ok}   每台设备第一次打开时报一次（前端 localStorage 记着，不再报），按 UTC 天 + 渠道计数，不存任何设备信息
   GET  /src/stats?key=邀请码    -> {total:[{src,n}], days:[{day,src,n}]}  最近 60 天
   POST /sub {email, lang, src}  -> {ok}   家长勾了同意才发；重复提交不报错（只更新 lang / src）
   POST /unsub {email}          -> {ok}   退订：直接删掉这一行
   GET  /sub/list?key=邀请码[&fmt=csv] -> {n, subs:[{email,lang,src,created}]} 或 CSV 下载（作者导出用）

   频率限制（2026-10-14，wrangler.toml 的 [[ratelimits]]）：按访问者 IP 计数，只在 Cloudflare 内存里，不写数据库、不存 IP。超了回 429 {error:'slow'}。
   LOOKUP_RL：手动输入的码（GET /f/:code 找回进度、GET /c/:code 加入班级）和要邀请码 / 老师钥匙的接口，每分钟 20 次，防止有人挨个试码；
   WRITE_RL：其余所有写入（自动备份、班级汇总、新建家庭码、留邮箱、渠道统计），每分钟 120 次，学校同一个 Wi-Fi 下几十台平板一起同步也够用。
   没配置这两个 binding（比如本地 wrangler dev 旧版本）就不限。 */
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
function cleanSt(st) {
  const out = {}; if (!st || typeof st !== 'object') return out;
  for (const k of ['w', 't', 'f']) {
    const m = st[k]; if (!m || typeof m !== 'object') continue; const o = {};
    for (const [x, v] of Object.entries(m).slice(0, 500)) { const n = Math.floor(+v); if (x.length <= 40 && n > 0 && n < 1e8) o[x] = n; }
    out[k] = o;
  }
  return out;
}
function mergeSt(a, b) { const out = {}; for (const k of ['w', 't', 'f']) { const o = { ...((a && a[k]) || {}) }; for (const [x, v] of Object.entries((b && b[k]) || {})) o[x] = Math.max(o[x] || 0, v); out[k] = o; } return out; }
function clean(players) {
  const out = {}; if (!players || typeof players !== 'object') return out;
  for (const [id, p] of Object.entries(players).slice(0, 60)) {
    if (!/^[\w-]{1,32}$/.test(id) || !p || typeof p !== 'object') continue;
    out[id] = { name: String(p.name || '').slice(0, 16), prog: cleanProg(p.prog), st: cleanSt(p.st), rid: String(p.rid || '').replace(/[^\w-]/g, '').slice(0, 20) };
  }
  return out;
}
function mergeProg(a, b) { const out = { ...a }; for (const [c, f] of Object.entries(b)) out[c] = Math.max(out[c] || 0, f); return out; }
function merge(base, inc) {
  const out = { ...base }; const del = base._del || {};
  for (const [id, p] of Object.entries(inc)) {
    if (id === '_del' || del[id]) continue;   // 删过的名字不再合并回来
    const q = out[id] ? { name: out[id].name, prog: { ...out[id].prog }, st: out[id].st } : { name: p.name, prog: {} };
    if (p.name) q.name = p.name;
    q.prog = mergeProg(q.prog, p.prog); q.st = mergeSt(q.st, p.st);
    out[id] = q;
  }
  return out;
}
const clientIp = req => req.headers.get('cf-connecting-ip') || 'unknown';
async function tooFast(rl, req) {
  if (!rl) return false;
  try { const { success } = await rl.limit({ key: clientIp(req) }); return !success; } catch (_) { return false; }   // 限流出错时放行，不影响孩子玩
}
/* 哪个限流器管这个请求：要人手输入的码、要密钥的接口归 LOOKUP_RL，其余写入归 WRITE_RL，其他（/yt、/stats、/usage、/push/key）不限 */
function limiterFor(req, env, url) {
  const p = url.pathname, m = req.method;
  if (m === 'GET' && (/^\/f\/[A-Z2-9]{8}$/.test(p) || /^\/c\/[A-Z2-9]{8}$/.test(p))) return env.LOOKUP_RL;
  if (url.searchParams.has('key') || p === '/c/new' || p === '/fb') return env.LOOKUP_RL;
  if (p === '/new' || p.startsWith('/f/') || p.startsWith('/c/') || p === '/sub' || p === '/unsub' || p === '/src') return env.WRITE_RL;
  return null;
}
async function readJson(req, max = 300000) {
  const body = await req.text();
  if (body.length > max) throw new Error('too big');
  return JSON.parse(body);
}

/* 渠道统计：?from=mama1 这种推广链接各带来多少台新设备。只记 (天, 渠道, 次数)。
   任何人都能调，所以渠道名只收 [a-z0-9_-]，一天最多 200 个不同渠道（再多的并到 (other)），防止被灌垃圾行 */
const SRC_RE = /^[a-z0-9_-]{1,24}$/;
const cleanSrc = s => { s = String(s || '').toLowerCase(); return SRC_RE.test(s) || s === '(none)' || s === '(old)' ? s : ''; };
const ownerKey = (env, url) => !!env.TEACHER_INVITE && url.searchParams.get('key') === env.TEACHER_INVITE;   // 作者 / 老师：和 /usage/test、/push/sub 一样用邀请码
const EMAIL_RE = /^[^\s@",;<>()]{1,64}@[^\s@",;<>()]+\.[a-z]{2,}$/i;
const MAX_SUBS = 50000;
const CRLF = '\r\n', CSV_BOM = String.fromCharCode(0xFEFF);
const csvCell = v => { let t = String(v == null ? '' : v); if (/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };   // 防 Excel 公式注入

async function channels(req, env, url) {
  if (url.pathname === '/src' && req.method === 'POST') {
    const s = cleanSrc(url.searchParams.get('from')) || '(none)'; const day = today();
    const has = await env.DB.prepare('SELECT 1 FROM src WHERE day=?1 AND src=?2').bind(day, s).first();
    let k = s;
    if (!has) { const c = await env.DB.prepare('SELECT COUNT(*) n FROM src WHERE day=?1').bind(day).first(); if (c.n >= 200) k = '(other)'; }
    await env.DB.prepare('INSERT INTO src(day,src,n) VALUES(?1,?2,1) ON CONFLICT(day,src) DO UPDATE SET n=n+1').bind(day, k).run();
    return json({ ok: true });
  }
  if (url.pathname === '/src/stats' && req.method === 'GET') {
    if (!ownerKey(env, url)) return json({ error: 'key' }, 403);
    const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const total = (await env.DB.prepare('SELECT src, SUM(n) n FROM src GROUP BY src ORDER BY n DESC').all()).results || [];
    const days = (await env.DB.prepare('SELECT day, src, n FROM src WHERE day>=?1 ORDER BY day DESC, n DESC').bind(since).all()).results || [];
    const subs = (await env.DB.prepare('SELECT COUNT(*) n FROM subs').first()).n;
    return json({ total, days, subs });
  }
  return json({ error: 'not found' }, 404);
}

/* 家长自愿留邮箱收更新：只存邮箱（小写）、语言、从哪个渠道来，和家庭码 / 孩子名字不关联。现在还不发邮件，作者用 /sub/list 导出 */
async function subscribers(req, env, url) {
  if (url.pathname === '/sub' && req.method === 'POST') {
    let b; try { b = await readJson(req, 1000); } catch (_) { return json({ error: 'bad json' }, 400); }
    const email = String((b && b.email) || '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'email' }, 400);
    if (!(b && b.agree === true)) return json({ error: 'agree' }, 400);   // 没勾同意不收
    const lang = /^[a-z]{2}$/.test(String(b.lang || '')) ? b.lang : '';
    const s = cleanSrc(b.src);
    const old = await env.DB.prepare('SELECT 1 FROM subs WHERE email=?1').bind(email).first();
    if (!old) { const c = await env.DB.prepare('SELECT COUNT(*) n FROM subs').first(); if (c.n >= MAX_SUBS) return json({ error: 'full' }, 503); }
    await env.DB.prepare('INSERT INTO subs(email,lang,src,created) VALUES(?1,?2,?3,?4) ON CONFLICT(email) DO UPDATE SET lang=?2').bind(email, lang, s, Date.now()).run();
    return json({ ok: true });
  }
  if (url.pathname === '/unsub' && req.method === 'POST') {
    let b; try { b = await readJson(req, 1000); } catch (_) { return json({ error: 'bad json' }, 400); }
    const email = String((b && b.email) || '').trim().toLowerCase();
    if (!email || email.length > 254) return json({ error: 'email' }, 400);
    await env.DB.prepare('DELETE FROM subs WHERE email=?1').bind(email).run();
    return json({ ok: true });   // 不告诉对方这个邮箱在不在名单里
  }
  if (url.pathname === '/sub/list' && req.method === 'GET') {
    if (!ownerKey(env, url)) return json({ error: 'key' }, 403);
    const rows = (await env.DB.prepare('SELECT email, lang, src, created FROM subs ORDER BY created').all()).results || [];
    if (url.searchParams.get('fmt') === 'csv') {
      const csv = CSV_BOM + 'email,lang,src,created' + CRLF + rows.map(r => [r.email, r.lang, r.src, new Date(r.created).toISOString()].map(csvCell).join(',')).join(CRLF) + CRLF;   // 带 BOM，Excel 打开不乱码
      return new Response(csv, { headers: { ...CORS, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="ziling-subs.csv"', 'cache-control': 'no-store' } });
    }
    return json({ n: rows.length, subs: rows });
  }
  return json({ error: 'not found' }, 404);
}

/* 意见箱：任何人可提交（受 LOOKUP_RL 限流），最多存 20000 条；作者在 admin.html 看 */
async function feedback(req, env, url) {
  if (url.pathname === '/fb' && req.method === 'POST') {
    let b; try { b = await readJson(req, 6000); } catch (_) { return json({ error: 'bad json' }, 400); }
    const text = String((b && b.text) || '').trim().slice(0, 2000);
    if (text.length < 2) return json({ error: 'text' }, 400);
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM fb').first(); if (c.n >= 20000) return json({ error: 'full' }, 503);
    await env.DB.prepare('INSERT INTO fb(text,contact,lang,src,at,created) VALUES(?1,?2,?3,?4,?5,?6)')
      .bind(text, String(b.contact || '').trim().slice(0, 120), /^[a-z]{2}$/.test(String(b.lang || '')) ? b.lang : '', cleanSrc(b.src), String(b.where || '').slice(0, 40), Date.now()).run();
    return json({ ok: true });
  }
  if (url.pathname === '/fb/list' && req.method === 'GET') {
    if (!ownerKey(env, url)) return json({ error: 'key' }, 403);
    return json({ fb: (await env.DB.prepare('SELECT id,text,contact,lang,src,at,created FROM fb ORDER BY id DESC LIMIT 500').all()).results || [] });
  }
  return json({ error: 'not found' }, 404);
}

/* 作者后台：最近更新的 1000 个家庭逐个列出；全站汇总算所有家庭（每个字写了几次、各内容看了多久、各功能用了几次） */
async function admin(req, env, url) {
  if (!ownerKey(env, url)) return json({ error: 'key' }, 403);
  const rows = (await env.DB.prepare('SELECT * FROM fam ORDER BY updated DESC').all()).results || [];
  const tot = { w: {}, t: {}, f: {} }; const fams = [];
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const top = (o, n) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  for (const r of rows) {
    let data; try { data = JSON.parse(r.data); } catch (_) { continue; }
    const kids = [];
    for (const [id, p] of Object.entries(data)) {
      if (id === '_del' || !p || typeof p !== 'object') continue;
      const st = p.st || {}; const prog = p.prog || {};
      for (const k of ['w', 't', 'f']) for (const [x, v] of Object.entries(st[k] || {})) tot[k][x] = (tot[k][x] || 0) + v;
      kids.push({ name: p.name, chars: Object.keys(prog).length, stars: sum(prog), writes: sum(st.w), secs: sum(st.t), topT: top(st.t, 5), topF: top(st.f, 5) });
    }
    if (fams.length < 1000 && kids.length) fams.push({ code: r.code, src: r.src || '', created: r.created, updated: r.updated, kids });
  }
  const cut = (o, n) => Object.fromEntries(top(o, n));
  return json({ n: rows.length, fams, tot: { w: cut(tot.w, 200), t: cut(tot.t, 200), f: cut(tot.f, 200) } });
}

async function family(req, env, url) {
  if (url.pathname === '/new' && req.method === 'POST') {
    for (let i = 0; i < 5; i++) {
      const c = newCode();
      try { await env.DB.prepare('INSERT INTO fam(code,data,updated,created) VALUES(?1,?2,?3,?3)').bind(c, '{}', Date.now()).run(); return json({ code: c }); } catch (_) {}
    }
    return json({ error: 'retry' }, 500);
  }
  const d = url.pathname.match(/^\/f\/([A-Z2-9]{8})\/p\/([\w.-]{1,50})$/);   // 家长删掉一个名字（知道家庭码即可）
  if (d && req.method === 'DELETE') {
    const r = await env.DB.prepare('SELECT data FROM fam WHERE code=?1').bind(d[1]).first();
    if (!r) return json({ error: 'no such code' }, 404);
    const data = JSON.parse(r.data); delete data[d[2]]; data._del = { ...(data._del || {}), [d[2]]: Date.now() };
    await env.DB.prepare('UPDATE fam SET data=?2,updated=?3 WHERE code=?1').bind(d[1], JSON.stringify(data), Date.now()).run();
    try { await env.DB.prepare('DELETE FROM mem WHERE id=?1').bind(d[1] + '.' + d[2]).run(); } catch (_) {}
    return json({ ok: true });
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
    const src = cleanSrc(url.searchParams.get('src'));
    if (src) { try { await env.DB.prepare('UPDATE fam SET src=?2 WHERE code=?1 AND src IS NULL').bind(code, src).run(); } catch (_) {} }   // 还没建 src 列时忽略
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
  const m = url.pathname.match(/^\/c\/([A-Z2-9]{8})(?:\/(members|leave|report|assign|roster|m\/([\w.-]{1,50})))?$/);
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
      const old = await env.DB.prepare('SELECT * FROM mem WHERE cls=?1 AND id=?2').bind(code, id).first();
      if (!old && (cnt.n + n) >= 60) break;
      const prog = old ? mergeProg(JSON.parse(old.prog), p.prog) : p.prog;
      await env.DB.prepare('INSERT INTO mem(cls,id,name,prog,updated,rid) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(cls,id) DO UPDATE SET name=excluded.name,prog=excluded.prog,updated=excluded.updated,rid=excluded.rid')
        .bind(code, id, p.name || '?', JSON.stringify(prog), now, p.rid || '').run();
      const st = mergeSt(old && old.st ? JSON.parse(old.st) : {}, p.st);
      try { await env.DB.prepare('UPDATE mem SET st=?3 WHERE cls=?1 AND id=?2').bind(code, id, JSON.stringify(st)).run(); } catch (_) {}   // 还没建 st 列时忽略
      n++;
    }
    return json({ ok: true, n, name: cls.name, assign, roster: roster.map(r => ({ id: r.id, name: r.name })) });
  }

  if (sub === 'leave' && req.method === 'POST') {
    let b; try { b = await readJson(req, 1000); } catch (_) { return json({ error: 'bad json' }, 400); }
    const fam = String((b && b.fam) || ''), pid = String((b && b.pid) || '');
    if (!/^[A-Z2-9]{8}$/.test(fam) || !/^[\w-]{1,32}$/.test(pid)) return json({ error: 'bad id' }, 400);
    await env.DB.prepare('DELETE FROM mem WHERE cls=?1 AND id=?2').bind(code, fam + '.' + pid).run();
    return json({ ok: true });
  }

  // 下面的都要老师钥匙
  const key = url.searchParams.get('key') || '';
  if (key !== cls.key) return json({ error: 'wrong key' }, 403);

  if (sub === 'report' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM mem WHERE cls=?1 ORDER BY updated DESC').bind(code).all()).results || [];
    return json({ name: cls.name, code, assign, roster, members: rows.map(r => ({ id: r.id, name: r.name, prog: JSON.parse(r.prog), st: r.st ? JSON.parse(r.st) : {}, updated: r.updated, rid: r.rid || '' })) });
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
    if (await tooFast(limiterFor(req, env, url), req)) return json({ error: 'slow' }, 429);
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
      if (url.pathname === '/src' || url.pathname === '/src/stats') return await channels(req, env, url);
      if (url.pathname === '/sub' || url.pathname === '/unsub' || url.pathname === '/sub/list') return await subscribers(req, env, url);
      if (url.pathname === '/fb' || url.pathname === '/fb/list') return await feedback(req, env, url);
      if (url.pathname === '/admin' && req.method === 'GET') return await admin(req, env, url);
      if (url.pathname.startsWith('/c/')) return await classes(req, env, url);
      return await family(req, env, url);
    } catch (e) { return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
  }
};
