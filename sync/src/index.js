/* 字灵乐园 · 家庭码云端备份（Cloudflare Worker + D1）
   POST /new            -> {code}            新建一个家庭码（8 位，去掉易混字母）
   GET  /f/:code        -> {data, updated}   取回这个家庭的进度
   PUT  /f/:code  body  -> {data, updated}   上传并合并（每个字取最高星，名字以最新为准）
   data 只有 { 玩家id: { name, prog:{字:星} } }，不存画作，不存任何联系方式。 */
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
function newCode() { const a = crypto.getRandomValues(new Uint8Array(8)); let s = ''; for (const b of a) s += ALPH[b % ALPH.length]; return s; }
function clean(players) {
  const out = {}; if (!players || typeof players !== 'object') return out;
  for (const [id, p] of Object.entries(players).slice(0, 60)) {
    if (!/^[\w-]{1,32}$/.test(id) || !p || typeof p !== 'object') continue;
    const prog = {};
    for (const [c, f] of Object.entries(p.prog || {})) { if (typeof c === 'string' && c.length <= 4) { const n = f | 0; if (n >= 1 && n <= 3) prog[c] = n; } }
    out[id] = { name: String(p.name || '').slice(0, 16), prog };
  }
  return out;
}
function merge(base, inc) {
  const out = { ...base };
  for (const [id, p] of Object.entries(inc)) {
    const q = out[id] ? { name: out[id].name, prog: { ...out[id].prog } } : { name: p.name, prog: {} };
    if (p.name) q.name = p.name;
    for (const [c, f] of Object.entries(p.prog)) q.prog[c] = Math.max(q.prog[c] || 0, f);
    out[id] = q;
  }
  return out;
}
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
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
      const body = await req.text();
      if (body.length > 300000) return json({ error: 'too big' }, 413);
      let inc; try { inc = clean(JSON.parse(body)); } catch (_) { return json({ error: 'bad json' }, 400); }
      const r = await env.DB.prepare('SELECT data FROM fam WHERE code=?1').bind(code).first();
      if (!r) return json({ error: 'no such code' }, 404);
      const merged = merge(JSON.parse(r.data), inc); const now = Date.now();
      await env.DB.prepare('UPDATE fam SET data=?2,updated=?3 WHERE code=?1').bind(code, JSON.stringify(merged), now).run();
      return json({ data: merged, updated: now });
    }
    return json({ error: 'method' }, 405);
  }
};
