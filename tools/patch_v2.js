// 第二轮改造：拼音全表 + 复合音节笔顺 + 英文释义 + HSK 分组 + 年级改名 + 童声/成人声切换
//            + 笔画加粗/提示高亮 + 减少重复语音 + 海报可点 + 标题回首页
// 用法：node tools/patch_v2.js   （先备份到 tools/index.before-v2.html）
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'index.html');
let h = fs.readFileSync(file, 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools', 'index.before-v2.html'), h);
const J = f => JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8')));

function rep(from, to, count = 1) {
  const n = h.split(from).length - 1;
  if (n !== count) throw new Error(`期望匹配 ${count} 次，实际 ${n} 次：${from.slice(0, 90)}`);
  h = h.split(from).join(to);
}
function repRe(re, to) {
  const m = h.match(re); if (!m) throw new Error('没匹配到：' + re);
  h = h.replace(re, to);
}

/* ---------- 1. 数据：拼音表、英文释义、HSK ---------- */
repRe(/^const LETTER_LINES=\{[\s\S]*?\};\n/m,
`const PINYIN=${J('pinyin.json')};
const LETTER_LINES=Object.fromEntries(Object.entries(PINYIN.items).map(([k,v])=>[k,v.line]));
`);
repRe(/^const LETTER_SAY=\{[^\n]*\};\n/m,
`const LETTER_SAY=Object.fromEntries(Object.entries(PINYIN.items).map(([k,v])=>[k,v.say.replace(/<[^>]*>/g,'')]));
const EN=${J('en_gloss.json')};
const HSK=${J('hsk30_chars.json')};
const HSK_LEVELS=Object.keys(HSK);const HSK_OF={};for(const lv of HSK_LEVELS)for(const c of HSK[lv])HSK_OF[c]=lv;
`);
rep(`const L=(s)=>s.split(' ').map(c=>({c,p:c,da:'',t:'letter',k:'儿歌',l:LETTER_LINES[c],s:'',letter:true}));`,
    `const L=(keys,pg)=>keys.map(c=>({c,p:c,da:'',t:'letter',k:'儿歌',l:LETTER_LINES[c],s:'',letter:true,pg}));`);

/* ---------- 2. 年级名字 ---------- */
rep(`const GRADE_META=[['0年级','拼音字母和最简单的字'],['1年级','最常用的 300 个字'],['2年级','常用字'],['3年级','常用字'],['4年级','常用字'],['5年级','常用字'],['6年级','常用字'],['7年级','通用规范字'],['8年级','通用规范字'],['9年级','通用规范字，集齐 3500 字'],['10年级','二级规范字'],['11年级','二级规范字'],['12年级','二级规范字'],['13年级','二级规范字'],['14年级','二级规范字'],['15年级','二级和三级规范字，集齐全部字库']];`,
`const GRADE_META=[['拼音','汉语拼音和最简单的字'],['一年级','最常用的 300 个字'],['二年级','常用字'],['三年级','常用字'],['四年级','常用字'],['五年级','常用字'],['六年级','常用字'],['七年级','通用规范字'],['八年级','通用规范字'],['九年级','通用规范字，集齐 3500 字'],['进阶一','二级规范字'],['进阶二','二级规范字'],['进阶三','二级规范字'],['进阶四','二级规范字'],['进阶五','二级规范字'],['进阶六','二级和三级规范字，集齐全部字库']];`);

/* ---------- 3. 复合音节的笔顺：把单个字母的笔画数据拼起来 ---------- */
rep(`const GRADES=GRADE_META.map((m,i)=>({id:i,name:m[0],sub:m[1],items:[]}));`,
`const LETTER_CACHE={};
function tfPath(p,tx,ty){let i=0;return p.replace(/-?\\d+(?:\\.\\d+)?|[A-Za-z]/g,t=>{if(/[A-Za-z]/.test(t)){i=0;return t}const v=parseFloat(t);return String(Math.round(((i++%2===0)?tx(v):ty(v))*10)/10)})}
function letterData(str){
 if(HDATA[str])return HDATA[str];
 if(LETTER_CACHE[str])return LETTER_CACHE[str];
 const parts=[...str].map(ch=>HDATA[ch]).filter(Boolean);
 const bbox=d=>{let a=1e9,b=-1e9;for(const m of d.medians)for(const [x] of m){a=Math.min(a,x);b=Math.max(b,x)}return [a,b]};
 const bs=parts.map(bbox),GAP=80,BASE=260;let total=GAP*(parts.length-1);bs.forEach(([a,b])=>total+=b-a);
 const s=Math.min(1,900/total);let x=(1024-total*s)/2;const strokes=[],medians=[];
 parts.forEach((d,i)=>{const [a,b]=bs[i];const dx=x-a*s;const tx=v=>v*s+dx,ty=v=>BASE+(v-BASE)*s;
  for(const p of d.strokes)strokes.push(tfPath(p,tx,ty));
  for(const m of d.medians)medians.push(m.map(([px,py])=>[Math.round(tx(px)),Math.round(ty(py))]));
  x+=(b-a)*s+GAP*s});
 return LETTER_CACHE[str]={strokes,medians};
}
const GRADES=GRADE_META.map((m,i)=>({id:i,name:m[0],sub:m[1],items:[]}));`);

rep(`GRADES[0].items.push(...L('a o e i u ü b p m f d t n l g k h j q x z c s r y w'));`,
    `for(const g of PINYIN.groups)GRADES[0].items.push(...L(g.items,g.name));`);
rep(`ALL.forEach((e,i)=>{e.num=i+1;if(e.letter)e.strokes=HDATA[e.c].strokes.length});`,
`/* 编号：原来的 26 个字母和汉字保持旧编号（和打印版卡片一致），新加的拼音排在最后 */
{const OLD26='a o e i u ü b p m f d t n l g k h j q x z c s r y w'.split(' ');let n=0;const late=[];
 ALL.forEach(e=>{if(e.letter)e.strokes=letterData(e.c).strokes.length;if(e.letter&&!OLD26.includes(e.c))late.push(e);else e.num=++n});late.forEach(e=>e.num=++n)}`);
rep(` if(HDATA[ch])return ok(HDATA[ch]);`, ` if(BY[ch]&&BY[ch].letter)return ok(letterData(ch));\n if(HDATA[ch])return ok(HDATA[ch]);`);

/* ---------- 4. 样式 ---------- */
rep(`.logo{font-size:26px;margin-right:auto;display:flex;align-items:center;gap:8px}`,
`.logo{font-size:26px;margin-right:auto;display:flex;align-items:center;gap:8px;background:none;padding:0;color:inherit}
.viewsw{display:flex;gap:6px;margin:4px 0 10px}.viewsw button{font-size:17px;padding:6px 14px;border-radius:999px;background:var(--paper);border:3px solid var(--line)}
.viewsw button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
h2 small{font-size:15px;margin-left:8px}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:17px;border-radius:999px;padding:5px 12px;background:var(--sun);color:#3a2a00;margin:4px 0}
.sndwrap{position:relative}.sndmenu{position:absolute;right:0;top:48px;background:var(--paper);border:3px solid var(--line);border-radius:18px;padding:8px;display:flex;flex-direction:column;gap:6px;z-index:9;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
.sndmenu button{font-size:18px;padding:8px 12px;border-radius:12px;background:var(--bg);text-align:left}.sndmenu button[aria-pressed="true"]{background:var(--sun);color:#3a2a00}
.pc{cursor:pointer}.pc:hover{filter:brightness(1.08)}
.legend button{font-family:inherit;font-size:inherit;color:inherit}`);
rep(`<div class="logo"><svg viewBox="0 0 200 200" id="logoSvg"></svg>字灵乐园</div>`,
    `<button class="logo" data-go="grades" aria-label="回到首页"><svg viewBox="0 0 200 200" id="logoSvg"></svg>字灵乐园</button>`);
rep(` <button class="snd" id="snd" aria-pressed="true" title="声音开 / 关" aria-label="声音开关">🔊</button>`,
` <div class="sndwrap"><button class="snd" id="snd" aria-pressed="true" title="声音" aria-label="声音设置" aria-haspopup="true">🔊</button>
  <div class="sndmenu" id="sndmenu" hidden><button data-vk="adult">👩 成人声</button><button data-vk="kid">🧒 童声</button><button data-vk="off">🔇 静音</button></div></div>`);

/* ---------- 5. 语音：成人 / 童声目录，减少重复 ---------- */
rep(`const AUDIO_DIR='audio/';const bufCache={};let curSrc=null,playToken=0;
const voiceOn=()=>S.voice!==false;`,
`const bufCache={};let curSrc=null,playToken=0;const said={};
const voiceOn=()=>S.voice!==false;const voiceKind=()=>S.vk==='kid'?'kid':'adult';const audioDir=()=>voiceKind()==='kid'?'audio/kid/':'audio/';`);
rep(`function loadClip(key){if(!bufCache[key]){bufCache[key]=fetch(AUDIO_DIR+encodeURIComponent(key)+'.mp3')`,
    `function loadClip(key){const ck=voiceKind()+'|'+key;if(!bufCache[ck]){bufCache[ck]=fetch(audioDir()+encodeURIComponent(key)+'.mp3')`);
rep(`.then(ab=>new Promise((ok,bad)=>ctx().decodeAudioData(ab,ok,bad)));bufCache[key].catch(()=>{delete bufCache[key]})}return bufCache[key]}`,
    `.then(ab=>new Promise((ok,bad)=>ctx().decodeAudioData(ab,ok,bad)));bufCache[ck].catch(()=>{delete bufCache[ck]})}return bufCache[ck]}`);
rep(`function toggleVoice(){S.voice=!voiceOn();save();stopVoice();const b=$('#snd');b.textContent=voiceOn()?'🔊':'🔇';b.setAttribute('aria-pressed',voiceOn())}`,
`function setVoice(vk){stopVoice();if(vk==='off'){S.voice=false}else{S.voice=true;S.vk=vk}save();
 const b=$('#snd');b.textContent=!voiceOn()?'🔇':voiceKind()==='kid'?'🧒':'🔊';b.setAttribute('aria-pressed',voiceOn());
 document.querySelectorAll('#sndmenu button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.vk===(voiceOn()?voiceKind():'off')));$('#sndmenu').hidden=true}
function sayOnce(flag,t,key){if(said[flag])return;said[flag]=1;say(t,key)}`);

/* ---------- 6. 写字页 ---------- */
rep(`function write(c){
 const e=BY[c],G=GRADES[e.g],idx=G.items.indexOf(e),next=G.items[idx+1];`,
`function seqFor(e){if(S.view==='hsk'&&!e.letter){const lv=S.hsk||'1';const seq=[...HSK[lv]].map(c=>BY[c]).filter(Boolean);if(seq.includes(e))return {seq,label:'HSK '+lv}}
 if(S.tf){const seq=GRADES[e.g].items.filter(x=>x.t===S.tf);if(seq.includes(e))return {seq,label:GRADES[e.g].name+' · '+TYPES[S.tf].n}}
 return {seq:GRADES[e.g].items,label:GRADES[e.g].name}}
function write(c){
 const e=BY[c],G=GRADES[e.g],{seq,label}=seqFor(e),idx=seq.indexOf(e),next=seq[idx+1];`);
rep(`<button class="big ghost" data-go="grades" style="font-size:18px;padding:8px 14px;margin-bottom:12px">← \${G.name}</button>`,
    `<button class="big ghost" data-go="grades" style="font-size:18px;padding:8px 14px;margin-bottom:12px">← \${label}</button>`);
rep(`<div class="big-ch \${e.letter?'lat':''}">\${esc(e.c)}</div>`,
    `<div class="big-ch \${e.letter?'lat':''}" style="\${e.c.length>2?'font-size:54px':''}">\${esc(e.c)}</div>`);
rep(`<div>\${e.letter?'<div class="py">拼音字母</div>':\`<div class="py">\${esc(e.p)}</div><div class="da">\${esc(e.da)}</div>\`}`,
    `<div>\${e.letter?\`<div class="py">\${esc(e.pg||'拼音')}</div><div class="da">\${esc((PINYIN.items[e.c]||{}).lesson||'')}</div>\`:\`<div class="py">\${esc(e.p)}</div><div class="da">\${esc(e.da)}\${EN[e.c]?' · '+esc(EN[e.c]):''}</div>\`}`);
rep(`drawingColor:'#2F6BFF',drawingWidth:e.letter?30:26,highlightColor:'#FFC72C',radicalColor:null,strokeAnimationSpeed:.9,delayBetweenStrokes:350,`,
    `drawingColor:'#2F6BFF',drawingWidth:e.letter?44:40,drawingFadeDuration:220,highlightColor:'#FF3B7A',strokeHighlightSpeed:1.3,radicalColor:null,strokeAnimationSpeed:.9,delayBetweenStrokes:350,`);
rep(`$('#msg').textContent='看好每一笔的方向哦';say('看好每一笔的方向哦','ui_watch')};`,
    `$('#msg').textContent='看好每一笔的方向哦';sayOnce('watch','看好每一笔的方向哦','ui_watch')};`);
rep(` let n=0;$('#msg').textContent='一笔一笔写，写对会变颜色';say('一笔一笔写，写对会变颜色','ui_start');`,
    ` let n=0;$('#msg').textContent='一笔一笔写，写对会变颜色';sayOnce('start','一笔一笔写，写对会变颜色','ui_start');`);
rep(` writer.quiz({leniency:e.letter?1.7:1.35,showHintAfterMisses:2,`,
    ` writer.quiz({leniency:(e.letter?1.7:1.35)*(FINE?1.15:1),showHintAfterMisses:2,`);
rep(`  onMistake:d=>{sBad();const m=d.mistakesOnStroke>=2?'看，闪光的地方就是下一笔':'再试一次，注意从哪里开始写';$('#msg').textContent=m;if(d.mistakesOnStroke===1||d.mistakesOnStroke===2)say(m,d.mistakesOnStroke===2?'ui_hint':'ui_retry')},`,
`  onMistake:d=>{sBad();const k=d.mistakesOnStroke;const m=k>=2?'看，闪光的地方就是下一笔':['再试一次，注意从哪里开始写','没关系，再来一次！','就差一点点，加油！'][d.strokeNum%3];$('#msg').textContent=m;
   if(k>=2){try{writer.highlightStroke(d.strokeNum)}catch(_){}}
   if(k===1)say(m,['ui_retry','ui_tryagain','ui_almost'][d.strokeNum%3]);else if(k===2)say(m,'ui_hint')},`);
rep(`voice=best<3?['ui_good'+(1+e.strokes%4),'ui_star'+stars]:['ui_again3']}`,
    `voice=best<3?['ui_good'+(1+e.num%8),'ui_star'+stars]:['ui_again3']}`);
rep(`if(!old){title=\`召唤成功！\`;sub=\`你得到了 \${cname(e,best)}\`;voice=['ui_summon','ui_star'+stars,e.c]}`,
    `if(!old){title=\`召唤成功！\`;sub=\`你得到了 \${cname(e,best)}\`;voice=['ui_good'+(1+e.num%8),'ui_summon','ui_star'+stars,e.c]}`);

/* ---------- 7. 选字页：年级 / HSK 切换，拼音分组，字系筛选 ---------- */
repRe(/function grades\(gid\)\{[\s\S]*?\n\}\n\/\* ---------- write ---------- \*\//,
`function grades(gid){
 if(gid!==undefined){S.grade=gid;save()}
 const hsk=S.view==='hsk';
 const tile=e=>{const s=starsOf(e.c);return \`<button class="tile \${s?'done':''}" data-w="\${esc(e.c)}" aria-label="写 \${esc(e.c)}，\${s} 颗星"><span class="ch \${e.letter?'lat':''}" style="\${e.c.length>2?'font-size:30px':e.c.length>1?'font-size:38px':''}">\${esc(e.c)}</span><span class="st">\${'★'.repeat(s)}\${'☆'.repeat(3-s)}</span>\${s?\`<span class="mini">\${mini(e,s)}</span>\`:''}</button>\`};
 let items,head,sub;
 if(hsk){const lv=HSK[S.hsk]?S.hsk:'1';S.hsk=lv;items=[...HSK[lv]].map(c=>BY[c]).filter(Boolean);
  head=\`<div class="tabs" role="tablist">\${HSK_LEVELS.map(l=>\`<button role="tab" aria-selected="\${l===lv}" data-hsk="\${l}">HSK \${l}</button>\`).join('')}</div>\`;sub=\`HSK 3.0 \${lv} 级汉字表，共 \${items.length} 个字\`}
 else{const G=GRADES[S.grade];items=G.items;head=gradeTabs(S.grade,'data-g');sub=G.sub}
 if(S.tf&&TYPES[S.tf])items=items.filter(e=>e.t===S.tf);
 const L=items.filter(e=>e.letter),H=items.filter(e=>!e.letter);
 const got=items.filter(e=>starsOf(e.c)).length;
 const pyHtml=PINYIN.groups.map(g=>{const its=L.filter(e=>e.pg===g.name);return its.length?\`<h2>\${g.name}<small class="muted">\${g.lesson||''}</small></h2><div class="tiles">\${its.map(tile).join('')}</div>\`:''}).join('');
 $('#main').innerHTML=\`<div class="viewsw"><button data-view="grade" aria-pressed="\${!hsk}">按年级</button><button data-view="hsk" aria-pressed="\${hsk}">按 HSK</button></div>\`+head+\`
 <p class="muted">\${sub}。已经召唤 \${got} / \${items.length} 只字灵。写得越好，字灵进化得越厉害：1 星小字灵，2 星字灵，3 星字灵大王。</p>
 \${S.tf&&TYPES[S.tf]?\`<button class="chip" id="tfclear">只看 \${TYPES[S.tf].n} ✕</button>\`:''}
 \${pyHtml}
 \${H.length?\`<h2>汉字</h2><div class="tiles">\${H.map(tile).join('')}</div>\`:''}\`;
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{S.view=b.dataset.view;save();grades()});
 document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>grades(+b.dataset.g));
 document.querySelectorAll('[data-hsk]').forEach(b=>b.onclick=()=>{S.hsk=b.dataset.hsk;save();grades()});
 if($('#tfclear'))$('#tfclear').onclick=()=>{S.tf=null;save();grades()};
 document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>go('write',b.dataset.w));
}
/* ---------- write ---------- */`);

/* ---------- 8. 海报：字灵可点，图例可点 ---------- */
rep(`crit+=\`<g transform="translate(\${cx+sz/2-100*sc} \${cy+sz/2-110*sc}) scale(\${sc})">\${creatureSVG(e,f)}</g>\`})}`,
    `crit+=\`<g class="pc" data-c="\${esc(e.c)}" transform="translate(\${cx+sz/2-100*sc} \${cy+sz/2-110*sc}) scale(\${sc})"><title>\${esc(cname(e,f))}</title>\${creatureSVG(e,f)}</g>\`})}`);
rep(` <div class="legend">\${Object.entries(TYPES).map(([k,t])=>\`<span style="background:\${t.m}">\${t.n} \${ALL.filter(e=>e.t===k&&best[e.c]).length}/\${ALL.filter(e=>e.t===k).length}</span>\`).join('')}</div>\`;
}`,
` <div class="legend">\${Object.entries(TYPES).map(([k,t])=>\`<button data-tf="\${k}" style="background:\${t.m}" title="去写\${t.n}的字">\${t.n} \${ALL.filter(e=>e.t===k&&best[e.c]).length}/\${ALL.filter(e=>e.t===k).length}</button>\`).join('')}</div>
 <p class="muted">点一只字灵看它的卡片；点下面的字系，去写那一系的字。</p>\`;
 $('.poster svg').addEventListener('click',ev=>{const g=ev.target.closest('[data-c]');if(!g)return;const e=BY[g.dataset.c];openCard(e,best[e.c])});
 document.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{S.tf=b.dataset.tf;S.view='grade';save();go('grades')});
}`);

/* ---------- 9. 启动 ---------- */
rep(`$('#snd').onclick=toggleVoice;$('#snd').textContent=voiceOn()?'🔊':'🔇';$('#snd').setAttribute('aria-pressed',voiceOn());`,
`const FINE=window.matchMedia&&window.matchMedia('(pointer:fine)').matches;
$('#snd').onclick=ev=>{ev.stopPropagation();$('#sndmenu').hidden=!$('#sndmenu').hidden};
document.querySelectorAll('#sndmenu button').forEach(b=>b.onclick=ev=>{ev.stopPropagation();setVoice(b.dataset.vk)});
document.addEventListener('click',()=>{$('#sndmenu').hidden=true});
setVoice(voiceOn()?voiceKind():'off');`);

fs.writeFileSync(file, h);
console.log('v2 改造完成，字符数', h.length);
