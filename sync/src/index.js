/* 字灵乐园 · 云端后端（Cloudflare Worker + D1）

   家庭码（家长用，自动生成）
   POST /new                    -> {code}            新建一个家庭码（8 位，去掉易混字母）
   GET  /f/:code                -> {data, updated}   取回这个家庭的进度
   PUT  /f/:code  body          -> {data, updated}   上传并合并（每个字取最高星，名字以最新为准）
   data 只有 { 玩家id: { name, prog:{字:星} } }，不存画作，不存任何联系方式。

   教师版（见 teacher.html）
   POST /c/new {name}           -> {code, key, name} 新建班级：班级码发给家长，老师钥匙只有老师留着
   GET  /c/:code                -> {name, assign}    学生端取班级名和本周生字（只要班级码）
   PUT  /c/:code/members {fam, players}              学生设备把加入了这个班的名字和进度汇总上来（每个字取最高星）
   GET  /c/:code/report?key=K   -> {name, code, assign, members:[{id,name,prog,updated}]}
   PUT  /c/:code/assign?key=K {chars, note}          老师布置本周生字
   DELETE /c/:code/m/:id?key=K                       老师把一个名字从班里移除 */
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
function newCode(n = 8) { const a = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (const b of a) s += ALPH[b % ALPH.length]; return s; }
function cleanProg(prog) {
  const out = {};
  for (const [c, f] of Object.entries(prog || {})) { if (typeof c === 'string' && c.length <= 4) { const n = f | 0; if (n >= 1 && n <= 3) out[c] = n; } }
  return out;
}
function clean(players) {
  const out = {}; if (!players || typeof players !== 'object') return out;
  for (const [id, p] of Object.entries(players).slice(0, 60)) {
    if (!/^[\w-]{1,32}$/.test(id) || !p || typeof p !== 'object') continue;
    out[id] = { name: String(p.name || '').slice(0, 16), prog: cleanProg(p.prog) };
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
    const name = String((b && b.name) || '').trim().slice(0, 30) || '我的班';
    for (let i = 0; i < 5; i++) {
      const code = newCode(8), key = newCode(16);
      try { await env.DB.prepare('INSERT INTO cls(code,key,name,assign,updated,created) VALUES(?1,?2,?3,?4,?5,?5)').bind(code, key, name, '{}', Date.now()).run(); return json({ code, key, name }); } catch (_) {}
    }
    return json({ error: 'retry' }, 500);
  }
  const m = url.pathname.match(/^\/c\/([A-Z2-9]{8})(?:\/(members|report|assign|m\/([\w.-]{1,50})))?$/);
  if (!m) return json({ error: 'not found' }, 404);
  const code = m[1], sub = m[2] || '', mid = m[3];
  const cls = await env.DB.prepare('SELECT code,key,name,assign FROM cls WHERE code=?1').bind(code).first();
  if (!cls) return json({ error: 'no such class' }, 404);
  const assign = JSON.parse(cls.assign || '{}');

  if (!sub && req.method === 'GET') return json({ name: cls.name, assign });

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
      await env.DB.prepare('INSERT INTO mem(cls,id,name,prog,updated) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(cls,id) DO UPDATE SET name=excluded.name,prog=excluded.prog,updated=excluded.updated')
        .bind(code, id, p.name || '?', JSON.stringify(prog), now).run();
      n++;
    }
    return json({ ok: true, n, name: cls.name, assign });
  }

  // 下面的都要老师钥匙
  const key = url.searchParams.get('key') || '';
  if (key !== cls.key) return json({ error: 'wrong key' }, 403);

  if (sub === 'report' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT id,name,prog,updated FROM mem WHERE cls=?1 ORDER BY updated DESC').bind(code).all()).results || [];
    return json({ name: cls.name, code, assign, members: rows.map(r => ({ id: r.id, name: r.name, prog: JSON.parse(r.prog), updated: r.updated })) });
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

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/c/')) return await classes(req, env, url);
      return await family(req, env, url);
    } catch (e) { return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
  }
};
