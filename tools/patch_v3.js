// 第三轮改造：奖励系统从“一字一怪兽”改为“字系 → 部落 → 部首徽章”
//   每个字的奖励 = 排版字卡（按笔画定稀有度）+ 给所属部落的字灵喂一口；24 只部落字灵三段进化；卡册多一个“部落”页；海报变成字灵王国。
// 用法：node tools/patch_v3.js  （先备份到 tools/index.before-v3.html）
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'index.html');
let h = fs.readFileSync(file, 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools', 'index.before-v3.html'), h);
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8'));
const tribes = rd('tribes.json'), map = rd('_tribe_map.json');
function rep(from, to, count = 1) {
  const n = h.split(from).length - 1;
  if (n !== count) throw new Error(`期望匹配 ${count} 次，实际 ${n} 次：${from.slice(0, 90)}`);
  h = h.split(from).join(to);
}

/* ---------- 1. 数据注入 ---------- */
const DATA = JSON.parse(h.match(/^const DATA=(\[\[.*?\]\]);/m)[1]);
const ids = tribes.tribes.map(t => t.id);
const idx = DATA.map(r => ids.indexOf(map.tribe[r[0]]).toString(36)).join('');
const rads = DATA.map(r => map.radical[r[0]] || '?');
if ([...idx].some(ch => ch === '-')) throw new Error('有字没有部落');
rep(`const HSK_LEVELS=Object.keys(HSK);`,
`const TRIBES=${JSON.stringify(tribes.tribes.map(t => ({id:t.id,type:t.type,name:t.name,creature:t.creature,emoji:t.emoji})))};const STAGES=${JSON.stringify(tribes.stages)};
const TRIBE_IDX='${idx}';const RADS=${JSON.stringify(rads)};
const HSK_LEVELS=Object.keys(HSK);`);
rep(`const BY=Object.fromEntries(ALL.map(e=>[e.c,e]));`,
`const BY=Object.fromEntries(ALL.map(e=>[e.c,e]));
const TRIBE_BY_ID=Object.fromEntries(TRIBES.map(t=>[t.id,t]));TRIBES.forEach(t=>t.members=[]);
DATA.forEach((r,i)=>{const e=BY[r[0]];e.tribe=TRIBES[parseInt(TRIBE_IDX[i],36)];e.rad=RADS[i];e.tribe.members.push(e)});
ALL.forEach(e=>{if(e.letter){e.tribe=TRIBE_BY_ID.pinyin;e.rad=e.pg||'拼音';e.tribe.members.push(e)}});
TRIBES.forEach(t=>{t.radList=[...new Set(t.members.map(m=>m.rad))]});`);
if (!/const LAT_FONT=/.test(h)) rep(`const FORM_NAME=`, `const LAT_FONT="'Andika','Noto Sans',Arial,sans-serif";\nconst FORM_NAME=`);

/* ---------- 2. 名字 / 统计 / 字灵绘制 / 字卡 ---------- */
rep(`function cname(e,f){return FORM_NAME[f].replace('{c}',e.c)}`,
`function cname(e,f){return e.c+'字卡'+(f?' '+'★'.repeat(f):'')}
function tname(t,s){return s===0?t.name+'的蛋':s===1?'小'+t.creature:s===2?t.creature:t.creature+'大王'}
function tribeStats(p,t){const fed=t.members.filter(e=>p&&p.prog[e.c]);const n=fed.length;const stage=n>=STAGES[2]?3:n>=STAGES[1]?2:n>=STAGES[0]?1:0;const badges=new Set(fed.map(e=>e.rad));
 return {fed:n,total:t.members.length,stage,badges,next:stage<3?STAGES[stage]-n:0,goal:stage<3?STAGES[stage]:STAGES[2]}}
function eggInner(t,progress){const col=TYPES[t.type].m;const cr=progress>=.66?'<path d="M85 70 l12 18 -10 14 14 16 -8 12" stroke="#8a6d3b" stroke-width="4" fill="none" stroke-linecap="round"/>':progress>=.33?'<path d="M85 70 l12 18 -10 14" stroke="#8a6d3b" stroke-width="4" fill="none" stroke-linecap="round"/>':'';
 return \`<ellipse cx="100" cy="112" rx="62" ry="78" fill="#FFF6E5" stroke="\${col}" stroke-width="8"/><ellipse cx="78" cy="80" rx="14" ry="22" fill="#fff" opacity=".7"/><circle cx="118" cy="122" r="10" fill="\${col}" opacity=".45"/><circle cx="86" cy="142" r="7" fill="\${col}" opacity=".45"/>\${cr}<text x="100" y="128" text-anchor="middle" font-size="40">\${t.emoji}</text>\`}
function tribeInner(t,s,st){if(s===0)return eggInner(t,st?st.fed/STAGES[0]:0);const key=\`tribe_\${t.id}_\${s}\`;if(ART.has(key))return \`<image href="art/\${key}.webp" width="200" height="200"/>\`;return creatureSVG(t.members[0],s)}
function tribeArt(t,s,st){return \`<svg viewBox="0 0 200 200" aria-label="\${esc(tname(t,s))}">\${tribeInner(t,s,st)}</svg>\`}
function charCardSVG(e,f,opts={}){const uid='k'+hashStr(e.c)+(opts.uid||'');const t=e.tribe,T=TYPES[e.t],n=e.strokes,lat=!!e.letter;
 const rar=lat?0:n<=4?0:n<=8?1:n<=12?2:3;const frames=[['#EEF3FA','#C9D8EA'],['#E9EEF5','#8FA6C4'],['#FFF0BF','#E0A800'],[\`url(#rb\${uid})\`,'#8A5CF6']];const [ff,fs]=frames[rar];
 const line=e.l||'';const parts=line.length>10?line.split(/(?<=[，。！？、])/).filter(Boolean):[line];
 const sub=lat?((PINYIN.items[e.c]||{}).lesson?'一年级上册 第 '+(PINYIN.items[e.c]||{}).lesson+' 课':''):(e.da+(EN[e.c]?' · '+EN[e.c]:''));
 return \`<svg viewBox="0 0 630 880" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="rb\${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB3C7"/><stop offset=".5" stop-color="#FFE27A"/><stop offset="1" stop-color="#9AD8FF"/></linearGradient></defs>
 <rect x="10" y="10" width="610" height="860" rx="36" fill="\${ff}" stroke="\${fs}" stroke-width="8"/><rect x="40" y="40" width="550" height="800" rx="26" fill="#fff"/>
 <path d="M40 66 a26 26 0 0 1 26 -26 h498 a26 26 0 0 1 26 26 v60 h-550z" fill="\${T.m}"/>
 <text x="64" y="98" font-size="34" fill="#fff" font-family="\${HAN_FONT}">\${t.emoji} \${esc(t.name)}</text><text x="566" y="98" font-size="28" fill="#fff" text-anchor="end" font-family="\${LAT_FONT}">No.\${String(e.num).padStart(4,'0')}</text>
 <text x="315" y="\${lat?420:445}" text-anchor="middle" font-size="\${lat?(e.c.length>2?160:e.c.length>1?220:290):330}" font-family="\${lat?LAT_FONT:HAN_FONT}" font-weight="\${lat?700:400}" fill="#1F2340">\${esc(e.c)}</text>
 <text x="315" y="520" text-anchor="middle" font-size="44" font-family="\${LAT_FONT}" fill="#2F6BFF">\${esc(lat?(e.pg||'拼音'):e.p)}</text>
 <text x="315" y="566" text-anchor="middle" font-size="26" font-family="\${LAT_FONT}" fill="#5E6488">\${esc(sub)}</text>
 \${parts.map((s,i)=>\`<text x="315" y="\${636+i*40}" text-anchor="middle" font-size="\${parts.length>1?28:30}" font-family="\${HAN_FONT}" fill="#1F2340">\${esc(s)}</text>\`).join('')}
 <g transform="translate(482 690) scale(.46)">\${tribeInner(t,1)}</g>
 <text x="64" y="812" font-size="40" fill="#FFC72C">\${'★'.repeat(f)}</text><text x="\${64+f*44}" y="812" font-size="40" fill="#E3E9F4">\${'★'.repeat(3-f)}</text>
 <text x="64" y="782" font-size="22" fill="#5E6488" font-family="\${HAN_FONT}">\${lat?'拼音':n+' 笔 · 部首 '+esc(e.rad)} · \${['普通','稀有','史诗','传说'][rar]}</text></svg>\`}`);

/* ---------- 3. 瓷砖、写字页、画板 ---------- */
rep("${s?`<span class=\"mini\">${mini(e,s)}</span>`:''}${(me().quest||{})[e.c]?", "${(me().quest||{})[e.c]?");
rep(`<div class="src">\${e.strokes} 笔　\${TYPES[e.t].n}　No.\${String(e.num).padStart(4,'0')}</div></div>
  <div class="mascot" style="margin-left:auto">\${mascotHTML(e,starsOf(c))}</div></div>`,
`<div class="src">\${e.strokes} 笔　\${e.letter?'':'部首 '+esc(e.rad)+'　'}No.\${String(e.num).padStart(4,'0')}</div></div>
  <div class="mascot" style="margin-left:auto">\${mascotHTML(e)}</div></div>
  <div class="src tribeline">\${(()=>{const st=tribeStats(me(),e.tribe);return \`\${e.tribe.emoji} \${esc(e.tribe.name)} · \${esc(tname(e.tribe,st.stage))}\${st.next?\`，再喂 \${st.next} 个字就\${st.stage?'进化':'孵化'}\`:' · 已经是大王'}\`})()}</div>`);
rep(`function mascotHTML(e,f){const key=\`\${e.c}_\${f||1}\`;if(f&&ART.has(key))return \`<img src="art/\${encodeURIComponent(e.c)}_\${f}.webp" alt="\${esc(cname(e,f))}">\`;
 return f?mini(e,f):\`<svg viewBox="0 0 200 200">\${creatureSVG(e,1,{silhouette:true,silColor:'#C9D3E6'})}</svg>\`}`,
`function mascotHTML(e){const st=tribeStats(me(),e.tribe);return tribeArt(e.tribe,st.stage,st)}`);
rep(`<div class="mascot" style="margin-left:auto">\${mascotHTML(e,starsOf(c))}</div></div>
  <p class="poem">\${esc(e.l)}</p><p class="muted">给「`, `<div class="mascot" style="margin-left:auto">\${mascotHTML(e)}</div></div>
  <p class="poem">\${esc(e.l)}</p><p class="muted">给「`);

/* ---------- 4. 完成：喂养 / 孵化 / 进化 ---------- */
rep(` const p=me(),old=p.prog[e.c]||0,best=Math.max(old,stars);p.prog[e.c]=best;save();setNav('grades');
 sWin();const r=$('#hw').getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,18);
 let title,sub,voice;
 if(!old){title=\`召唤成功！\`;sub=\`你得到了 \${cname(e,best)}\`;voice=['ui_good'+(1+e.num%8),'ui_summon','ui_star'+stars,e.c]}
 else if(best>old){title=\`进化啦！\`;sub=\`\${cname(e,old)} 变成了 \${cname(e,best)}\`;voice=['ui_evolve','ui_star'+stars,e.c]}
 else if(stars<best){title=\`这次 \${stars} 颗星\`;sub=\`你的 \${cname(e,best)} 还在卡册里。最好成绩不会变少\`;voice=['ui_star'+stars,'ui_keep']}
 else{title=\`又是 \${stars} 颗星！\`;sub=best<3?\`写到 3 颗星，它会进化成 \${cname(e,3)}\`:\`字灵大王为你骄傲\`;voice=best<3?['ui_good'+(1+e.num%8),'ui_star'+stars]:['ui_again3']}
 setTimeout(()=>openCard(e,best,{title,sub,stars,after:true,voice}),700);`,
` const p=me(),old=p.prog[e.c]||0,best=Math.max(old,stars);const t=e.tribe,before=tribeStats(p,t);p.prog[e.c]=best;save();setNav('grades');const after=tribeStats(p,t);
 sWin();const r=$('#hw').getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,18);
 let title,sub,voice;const feed=after.next?\`再喂 \${after.next} 个字就\${after.stage?'进化':'孵化'}\`:'';
 if(after.stage>before.stage&&before.stage===0){title=\`孵化啦！\`;sub=\`\${tname(t,1)} 从蛋里出来了！「\${e.c}」字卡也收进了卡册\`;voice=['ui_hatch','ui_star'+stars,e.c]}
 else if(after.stage>before.stage){title=\`进化啦！\`;sub=\`\${tname(t,before.stage)} 变成了 \${tname(t,after.stage)}\`;voice=['ui_evolve','ui_star'+stars,e.c]}
 else if(!old){title=\`字卡到手！\`;sub=\`「\${e.c}」收进卡册，喂了\${before.stage?t.creature:t.name+'的蛋'}一口\${feed?'，'+feed:''}\`;voice=['ui_good'+(1+e.num%8),'ui_card','ui_star'+stars,e.c]}
 else if(stars<best){title=\`这次 \${stars} 颗星\`;sub=\`你的 \${cname(e,best)} 还在卡册里。最好成绩不会变少\`;voice=['ui_star'+stars,'ui_keep']}
 else if(best>old){title=\`升到 \${best} 颗星！\`;sub=\`「\${e.c}」字卡更亮了\${feed?'。'+feed:''}\`;voice=['ui_good'+(1+e.num%8),'ui_star'+stars,e.c]}
 else{title=\`又是 \${stars} 颗星！\`;sub=best<3?\`写到 3 颗星，字卡会变成金星卡\`:\`\${t.creature}为你骄傲\`;voice=best<3?['ui_good'+(1+e.num%8),'ui_star'+stars]:['ui_again3']}
 setTimeout(()=>openCard(e,best,{title,sub,stars,after:true,voice,st:after,hatched:after.stage>before.stage}),700);`);

/* ---------- 5. 弹窗：字卡 + 部落进度 ---------- */
rep(` <div class="cardwrap pop">\${cardSVG(e,f,e.strokes,e.num,{uid:'m'})}</div>`, ` <div class="cardwrap pop">\${charCardSVG(e,f,{uid:'m'})}</div>`);
rep(` <div class="forms">\${[1,2,3].map(k=>\`<div title="\${cname(e,k)}"><svg viewBox="0 0 200 200">\${creatureSVG(e,k,{silhouette:k>f,silColor:'#3a4370'})}</svg><div style="font-size:14px">\${k<=f?cname(e,k):'？？？'}</div></div>\`).join('')}</div>`,
` \${(()=>{const t=e.tribe,st=o.st||tribeStats(me(),t);return \`<div class="tribebox \${o.hatched?'pop':''}"><div class="mascot">\${tribeArt(t,st.stage,st)}</div><div style="text-align:left;flex:1;min-width:0"><b>\${t.emoji} \${esc(t.name)}</b> · \${esc(tname(t,st.stage))}<div class="prog" style="margin:6px 0"><i style="width:\${Math.min(100,st.fed/st.goal*100)}%"></i></div><div class="src" style="color:#cfd6f0">已喂 \${st.fed} / \${st.total} 个字\${st.next?\`，再喂 \${st.next} 个\${st.stage?'进化':'孵化'}\`:'，已经是大王'}　徽章 \${st.badges.size} / \${t.radList.length}</div></div></div>\`})()}`);
rep(`<button class="big" id="mWrite">去写 \${esc(e.c)}</button><button class="big ghost" id="mDraw">🎨 画一画</button>`,
    `<button class="big" id="mWrite">去写 \${esc(e.c)}</button><button class="big ghost" id="mTribe">看部落</button><button class="big ghost" id="mDraw">🎨 画一画</button>`);
rep(` if($('#mDraw'))$('#mDraw').onclick=()=>go('draw',e.c);`, ` if($('#mDraw'))$('#mDraw').onclick=()=>go('draw',e.c);\n if($('#mTribe'))$('#mTribe').onclick=()=>{S.atab='tribes';save();go('album')};`);

/* ---------- 6. 打印、卡册 ---------- */
rep("box.innerHTML=list.map(([e,f],i)=>`<div class=\"pcard\">${cardSVG(e,f,e.strokes,e.num,{uid:'p'+i})}</div>`).join('');",
    "box.innerHTML=list.map(([e,f],i)=>`<div class=\"pcard\">${charCardSVG(e,f,{uid:'p'+i})}</div>`).join('');");
rep(` $('#main').innerHTML=\`<h1>\${esc(p.name)} 的卡册</h1><p class="muted">已收集 \${got} / \${ALL.length} 张，其中金卡 \${gold} 张。笔画多的字写到 3 颗星会变成闪卡。</p>
 <div class="prog"><i style="width:\${got/ALL.length*100}%"></i></div>`,
` const tribesMode=S.atab==='tribes';const hatched=TRIBES.filter(t=>tribeStats(p,t).stage>0).length;
 $('#main').innerHTML=\`<h1>\${esc(p.name)} 的卡册</h1><div class="viewsw"><button data-atab="cards" aria-pressed="\${!tribesMode}">字卡 \${got}</button><button data-atab="tribes" aria-pressed="\${tribesMode}">部落 \${hatched} / \${TRIBES.length}</button></div>\`+(tribesMode?\`<p class="muted">每写对一个字，就是喂了它所属部落的字灵一口。喂 \${STAGES[0]} 个孵化，\${STAGES[1]} 个进化，\${STAGES[2]} 个变成大王；集齐部落里所有部首徽章，就是族长。</p>
 <div class="tribes">\${TRIBES.map(t=>{const st=tribeStats(p,t);return \`<div class="tcard" style="--c:\${TYPES[t.type].m}"><div class="mascot">\${tribeArt(t,st.stage,st)}</div><b>\${t.emoji} \${esc(t.name)}</b><div class="src">\${esc(tname(t,st.stage))} · 已喂 \${st.fed} / \${st.total}</div><div class="prog"><i style="width:\${Math.min(100,st.fed/st.goal*100)}%"></i></div><div class="badges">\${t.radList.slice(0,14).map(r=>\`<span class="\${st.badges.has(r)?'on':''}" title="部首 \${esc(r)}">\${esc(r)}</span>\`).join('')}\${t.radList.length>14?\`<span>+\${t.radList.length-14}</span>\`:''}</div><button class="big ghost" data-tribe="\${t.id}" style="font-size:16px;padding:6px 12px">去写\${esc(t.name)}的字</button></div>\`}).join('')}</div>\`:\`<p class="muted">已收集 \${got} / \${ALL.length} 张，其中三星卡 \${gold} 张。笔画越多的字，卡框越稀有：普通、稀有、史诗、传说。</p>
 <div class="prog"><i style="width:\${got/ALL.length*100}%"></i></div>\`);
 if(tribesMode){document.querySelectorAll('[data-atab]').forEach(b=>b.onclick=()=>{S.atab=b.dataset.atab;save();album()});document.querySelectorAll('[data-tribe]').forEach(b=>b.onclick=()=>{S.tfb=b.dataset.tribe;S.tf=null;S.view='grade';save();go('grades')});return}
 $('#main').innerHTML+=\``);
rep(`\${gradeTabs(S.agrade,'data-ag')}
 <div class="ctrls" style="margin:4px 0 14px"><span class="muted" style="align-self:center">\${G.name}已收集`, `\${gradeTabs(S.agrade,'data-ag')}
 <div class="ctrls" style="margin:4px 0 14px"><span class="muted" style="align-self:center">\${G.name}已收集`);
rep("return f?`<button class=\"slot\" data-c=\"${esc(e.c)}\" aria-label=\"${cname(e,f)}\">${cardSVG(e,f,e.strokes,e.num,{uid:'a'})}</button>`\n  :`<button class=\"slot\" data-c=\"${esc(e.c)}\" aria-label=\"还没收集 ${esc(e.c)}\"><div class=\"lockcard\"><svg viewBox=\"0 0 200 200\">${creatureSVG(e,1,{silhouette:true,silColor:'#9AA6C4'})}</svg>No.${String(e.num).padStart(4,'0')}</div></button>`}).join('')}</div>`;",
    "return f?`<button class=\"slot\" data-c=\"${esc(e.c)}\" aria-label=\"${cname(e,f)}\">${charCardSVG(e,f,{uid:'a'})}</button>`\n  :`<button class=\"slot\" data-c=\"${esc(e.c)}\" aria-label=\"还没收集 ${esc(e.c)}\"><div class=\"lockcard\"><div class=\"${e.letter?'lat':''}\" style=\"font-size:54px;opacity:.3;line-height:1.1\">${esc(e.c)}</div>No.${String(e.num).padStart(4,'0')}</div></button>`}).join('')}</div>`;\n document.querySelectorAll('[data-atab]').forEach(b=>b.onclick=()=>{S.atab=b.dataset.atab;save();album()});");

/* ---------- 7. 选字页：部落筛选 ---------- */
rep(` if(S.tf&&TYPES[S.tf])items=items.filter(e=>e.t===S.tf);
 const L=items.filter(e=>e.letter),H=items.filter(e=>!e.letter);`,
` if(S.tf&&TYPES[S.tf])items=items.filter(e=>e.t===S.tf);
 if(S.tfb&&TRIBE_BY_ID[S.tfb])items=items.filter(e=>e.tribe.id===S.tfb);
 const L=items.filter(e=>e.letter),H=items.filter(e=>!e.letter);`);
rep(` \${S.tf&&TYPES[S.tf]?\`<button class="chip" id="tfclear">只看 \${TYPES[S.tf].n} ✕</button>\`:''}`,
    ` \${S.tf&&TYPES[S.tf]?\`<button class="chip" id="tfclear">只看 \${TYPES[S.tf].n} ✕</button>\`:''}\${S.tfb&&TRIBE_BY_ID[S.tfb]?\`<button class="chip" id="tfbclear">只看 \${TRIBE_BY_ID[S.tfb].emoji} \${TRIBE_BY_ID[S.tfb].name} ✕</button>\`:''}`);
rep(` if($('#tfclear'))$('#tfclear').onclick=()=>{S.tf=null;save();grades()};`,
    ` if($('#tfclear'))$('#tfclear').onclick=()=>{S.tf=null;save();grades()};\n if($('#tfbclear'))$('#tfbclear').onclick=()=>{S.tfb=null;save();grades()};`);
rep(` if(S.tf){const seq=GRADES[e.g].items.filter(x=>x.t===S.tf);if(seq.includes(e))return {seq,label:GRADES[e.g].name+' · '+TYPES[S.tf].n}}`,
    ` if(S.tf){const seq=GRADES[e.g].items.filter(x=>x.t===S.tf);if(seq.includes(e))return {seq,label:GRADES[e.g].name+' · '+TYPES[S.tf].n}}
 if(S.tfb){const seq=GRADES[e.g].items.filter(x=>x.tribe.id===S.tfb);if(seq.includes(e))return {seq,label:GRADES[e.g].name+' · '+TRIBE_BY_ID[S.tfb].name}}`);

/* ---------- 8. 海报：字灵王国 ---------- */
rep(` const groups={};ALL.forEach(e=>{if(best[e.c])(groups[e.t]=groups[e.t]||[]).push(e)});
 let crit='';
 for(const[t,list]of Object.entries(groups)){const[x,y,w,h]=zones[t];let sz=80;while(sz>18&&Math.floor(w/sz)*Math.floor(h/sz)<list.length)sz-=2;const cols=Math.floor(w/sz);
  list.forEach((e,i)=>{const f=best[e.c];const cx=x+(i%cols)*sz+(Math.floor(i/cols)%2?sz/2:0)*(cols*sz+sz/2<=w?1:0),cy=y+Math.floor(i/cols)*sz;const sc=sz/200*(1+f*0.1);
   crit+=\`<g class="pc" data-c="\${esc(e.c)}" transform="translate(\${cx+sz/2-100*sc} \${cy+sz/2-110*sc}) scale(\${sc})"><title>\${esc(cname(e,f))}</title>\${creatureSVG(e,f)}</g>\`})}
 const got=Object.keys(best).length;`,
` const classP={prog:best};let crit='';
 for(const [ty,[x,y,w,h]] of Object.entries(zones)){const ts=TRIBES.filter(t=>t.type===ty);const n=ts.length;if(!n)continue;
  ts.forEach((t,i)=>{const st=tribeStats(classP,t);const sz=Math.min(h,w/n,70+st.stage*22);const cx=x+(i+.5)*w/n,cy=y+h/2;const sc=sz/200;
   crit+=\`<g class="pc" data-tribe="\${t.id}" transform="translate(\${cx-100*sc} \${cy-100*sc}) scale(\${sc})"><title>\${esc(t.name)} · \${esc(tname(t,st.stage))} · 已喂 \${st.fed}</title>\${tribeInner(t,st.stage,st)}</g><text x="\${cx}" y="\${cy+sz/2+16}" text-anchor="middle" font-size="15" font-family="\${HAN_FONT}" fill="#1f2340">\${esc(t.name)}</text>\`})}
 const got=Object.keys(best).length;const hatchedN=TRIBES.filter(t=>tribeStats(classP,t).stage>0).length;`);
rep(` $('#main').innerHTML=\`<h1>全班海报</h1><p class="muted">这台设备上 \${pl.length} 个小朋友一起召唤的字灵都住在这里。每一只都来自一个写对的字。</p>
 <div class="prog"><i style="width:\${got/ALL.length*100}%"></i></div><p style="font-size:22px;margin:4px 0 12px">全班已经召唤 \${got} / \${ALL.length} 只</p>`,
` $('#main').innerHTML=\`<h1>字灵王国</h1><p class="muted">这台设备上 \${pl.length} 个小朋友一起喂养的 \${TRIBES.length} 个部落都住在这里。大家写对的字越多，字灵长得越大。</p>
 <div class="prog"><i style="width:\${got/ALL.length*100}%"></i></div><p style="font-size:22px;margin:4px 0 12px">全班一起写对 \${got} 个字，\${hatchedN} / \${TRIBES.length} 个部落已孵化</p>`);
rep(` <p class="muted">点一只字灵看它的卡片；点下面的字系，去写那一系的字。</p>\`;
 $('.poster svg').addEventListener('click',ev=>{const g=ev.target.closest('[data-c]');if(!g)return;const e=BY[g.dataset.c];openCard(e,best[e.c])});`,
` <p class="muted">点一只字灵去写它部落的字；点下面的字系，去写那一系的字。</p>\`;
 $('.poster svg').addEventListener('click',ev=>{const g=ev.target.closest('[data-tribe]');if(!g)return;S.tfb=g.dataset.tribe;S.tf=null;S.view='grade';save();go('grades')});`);

/* ---------- 9. 样式 ---------- */
rep(`.mascot{width:120px;height:120px;flex:none}`,
`.mascot{width:120px;height:120px;flex:none}.tribeline{margin-top:6px}
.tribebox{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.08);border-radius:18px;padding:10px 14px;margin:12px auto 0;max-width:420px;text-align:left}.tribebox .mascot{width:84px;height:84px}
.tribes{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-top:12px}
.tcard{background:var(--paper);border:3px solid var(--line);border-top:8px solid var(--c);border-radius:22px;padding:12px;text-align:center}.tcard .mascot{margin:0 auto}.tcard b{font-size:20px;display:block;margin-top:4px}
.badges{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:8px 0}.badges span{font-size:14px;border-radius:999px;padding:2px 7px;background:var(--locked);color:var(--soft)}.badges span.on{background:var(--sun);color:#3a2a00}
.lockcard .lat{font-family:var(--lat);font-weight:700}`);

fs.writeFileSync(file, h);
console.log('v3 改造完成，字符数', h.length);
