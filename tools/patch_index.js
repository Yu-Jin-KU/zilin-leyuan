// 一次性改造脚本：把 index.html 从“依赖 CDN + 浏览器朗读”改成“全本地 + Fish Audio 预生成语音 + 可离线 PWA”
// 用法：node tools/patch_index.js   （会先备份到 tools/index.before-patch.html）
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'index.html');
let h = fs.readFileSync(file, 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools', 'index.before-patch.html'), h);

function rep(from, to, count = 1) {
  const n = h.split(from).length - 1;
  if (n !== count) throw new Error(`期望匹配 ${count} 次，实际 ${n} 次：${from.slice(0, 80)}`);
  h = h.split(from).join(to);
}

// 1. 字体：Google Fonts -> 本地子集 woff2；加 PWA / 分享元信息
rep(`<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Andika:wght@400;700&family=ZCOOL+KuaiLe&display=swap" rel="stylesheet">`,
`<meta name="description" content="免费的汉字 / 拼音笔顺小游戏：看笔顺、自己写、写对就召唤一只字灵。6700 个字，不用登录、没有广告、可离线。">
<meta name="theme-color" content="#E8F6FF">
<meta property="og:title" content="字灵乐园 · 写字召唤小怪兽"><meta property="og:description" content="免费的汉字笔顺小游戏：写对一个字，召唤一只字灵。6700 个字，不用登录，没有广告。"><meta property="og:image" content="share.png"><meta property="og:type" content="website">
<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="字灵乐园">`);

rep(`<style>\n:root{box-sizing:border-box;`,
`<style>
@font-face{font-family:'ZCOOL KuaiLe';src:url(fonts/ZCOOLKuaiLe-sub.woff2) format('woff2');font-display:swap}
@font-face{font-family:'Andika';font-weight:400;src:url(fonts/Andika-Regular-sub.woff2) format('woff2');font-display:swap}
@font-face{font-family:'Andika';font-weight:700;src:url(fonts/Andika-Bold-sub.woff2) format('woff2');font-display:swap}
:root{box-sizing:border-box;`);

// 2. 声音开关按钮样式
rep(`.who{background:var(--sun);color:#3a2a00;border-radius:999px;padding:8px 14px;font-size:18px}`,
`.who{background:var(--sun);color:#3a2a00;border-radius:999px;padding:8px 14px;font-size:18px}
.snd{background:var(--paper);border:3px solid var(--line);border-radius:999px;padding:6px 12px;font-size:18px}
.snd[aria-pressed="false"]{opacity:.55}`);

rep(`<button class="who" id="who" data-go="players">选人</button>`,
`<button class="who" id="who" data-go="players">选人</button>
 <button class="snd" id="snd" aria-pressed="true" title="声音开 / 关" aria-label="声音开关">🔊</button>`);

// 3. Hanzi Writer 库本地化
rep(`<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>`,
`<script src="lib/hanzi-writer.min.js"></script>`);

// 4. 笔顺数据本地化（本地找不到再退回 CDN）
rep(`const CDN='https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';`,
`const CDN='data/',CDN_FALLBACK='https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';`);
rep(` fetch(CDN+encodeURIComponent(ch)+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{cache[ch]=d;ok(d)}).catch(e=>err(e));`,
` const get=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
 get(CDN+encodeURIComponent(ch)+'.json').catch(()=>get(CDN_FALLBACK+encodeURIComponent(ch)+'.json')).then(d=>{cache[ch]=d;ok(d)}).catch(e=>err(e));`);

// 5. 语音：Fish Audio 预生成的 mp3 优先，没有文件时退回浏览器朗读
rep(`function say(t){try{const u=new SpeechSynthesisUtterance(t);u.lang='zh-CN';u.rate=.8;const v=speechSynthesis.getVoices().find(v=>/zh[-_]CN/i.test(v.lang));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(_){}}`,
`/* 语音：audio/<字>.mp3 由 Fish Audio 预生成（见 tools/gen_audio.py）；文件缺失或离线时退回浏览器自带朗读 */
const AUDIO_DIR='audio/';const aCache={};let curA=null,playToken=0;
const voiceOn=()=>S.voice!==false;
function clip(key){let a=aCache[key];if(!a){a=new Audio(AUDIO_DIR+encodeURIComponent(key)+'.mp3');a.preload='auto';aCache[key]=a}return a}
function preloadVoice(keys){for(const k of keys)clip(k)}
function stopVoice(){playToken++;if(curA){try{curA.pause();curA.currentTime=0}catch(_){}curA=null}try{speechSynthesis.cancel()}catch(_){}}
function speakTTS(t){try{const u=new SpeechSynthesisUtterance(t);u.lang='zh-CN';u.rate=.8;const v=speechSynthesis.getVoices().find(v=>/zh[-_]CN/i.test(v.lang));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(_){}}
function say(t,keys){
 if(!voiceOn())return;stopVoice();
 if(!keys)return speakTTS(t);
 keys=Array.isArray(keys)?keys:[keys];const my=playToken;let i=0;
 const next=()=>{if(my!==playToken||i>=keys.length){curA=null;return}const a=clip(keys[i++]);curA=a;a.currentTime=0;
  a.onended=next;a.onerror=()=>{if(my!==playToken)return;curA=null;if(i===1)speakTTS(t)};
  const p=a.play();if(p&&p.catch)p.catch(()=>{if(my===playToken&&i===1)speakTTS(t)})};
 next();
}
function toggleVoice(){S.voice=!voiceOn();save();stopVoice();const b=$('#snd');b.textContent=voiceOn()?'🔊':'🔇';b.setAttribute('aria-pressed',voiceOn())}`);

// 6. 写字页：进入时自动读一遍；按钮用预生成语音
rep(` $('#bSay').onclick=()=>say(e.letter?LETTER_SAY[e.c]+'，'+e.l.replace(/[a-zü ]+/g,''):e.c+'。'+e.l);
 $('#bAnim').onclick=()=>{clearTimeout(autoT);writer.cancelQuiz();writer.hideCharacter();writer.animateCharacter();$('#msg').textContent='看好每一笔的方向哦'};`,
` const sayText=e.letter?LETTER_SAY[e.c]+'，'+e.l.replace(/[a-zü ]+/g,''):e.c+'。'+e.l;
 preloadVoice([e.c,'ui_start','ui_hint','ui_retry','ui_summon','ui_evolve']);if(next)preloadVoice([next.c]);
 $('#bSay').onclick=()=>say(sayText,e.c);
 $('#bAnim').onclick=()=>{clearTimeout(autoT);writer.cancelQuiz();writer.hideCharacter();writer.animateCharacter();$('#msg').textContent='看好每一笔的方向哦';say('看好每一笔的方向哦','ui_watch')};
 setTimeout(()=>say(sayText,e.c),250);`);

// 7. 写的过程：开始、提示、错两次时用语音
rep(` let n=0;$('#msg').textContent='一笔一笔写，写对会变颜色';`,
` let n=0;$('#msg').textContent='一笔一笔写，写对会变颜色';say('一笔一笔写，写对会变颜色','ui_start');`);
rep(`  onMistake:d=>{sBad();$('#msg').textContent=d.mistakesOnStroke>=2?'看，闪光的地方就是下一笔':'再试一次，注意从哪里开始写'},`,
`  onMistake:d=>{sBad();const m=d.mistakesOnStroke>=2?'看，闪光的地方就是下一笔':'再试一次，注意从哪里开始写';$('#msg').textContent=m;if(d.mistakesOnStroke===1||d.mistakesOnStroke===2)say(m,d.mistakesOnStroke===2?'ui_hint':'ui_retry')},`);

// 8. 完成：按结果选语音
rep(` let title,sub;
 if(!old){title=\`召唤成功！\`;sub=\`你得到了 \${cname(e,best)}\`}
 else if(best>old){title=\`进化啦！\`;sub=\`\${cname(e,old)} 变成了 \${cname(e,best)}\`}
 else if(stars<best){title=\`这次 \${stars} 颗星\`;sub=\`你的 \${cname(e,best)} 还在卡册里。最好成绩不会变少\`}
 else{title=\`又是 \${stars} 颗星！\`;sub=best<3?\`写到 3 颗星，它会进化成 \${cname(e,3)}\`:\`字灵大王为你骄傲\`}
 setTimeout(()=>openCard(e,best,{title,sub,stars,after:true}),700);`,
` let title,sub,voice;
 if(!old){title=\`召唤成功！\`;sub=\`你得到了 \${cname(e,best)}\`;voice=['ui_summon','ui_star'+stars,e.c]}
 else if(best>old){title=\`进化啦！\`;sub=\`\${cname(e,old)} 变成了 \${cname(e,best)}\`;voice=['ui_evolve','ui_star'+stars,e.c]}
 else if(stars<best){title=\`这次 \${stars} 颗星\`;sub=\`你的 \${cname(e,best)} 还在卡册里。最好成绩不会变少\`;voice=['ui_star'+stars,'ui_keep']}
 else{title=\`又是 \${stars} 颗星！\`;sub=best<3?\`写到 3 颗星，它会进化成 \${cname(e,3)}\`:\`字灵大王为你骄傲\`;voice=best<3?['ui_good'+(1+n%4),'ui_star'+stars]:['ui_again3']}
 setTimeout(()=>openCard(e,best,{title,sub,stars,after:true,voice}),700);`);
// finish() 里没有 n，改用笔画数做轮换
rep(`voice=best<3?['ui_good'+(1+n%4),'ui_star'+stars]:['ui_again3']}`, `voice=best<3?['ui_good'+(1+e.strokes%4),'ui_star'+stars]:['ui_again3']}`);

rep(` $('#modal').classList.add('open');say(cname(e,f));`,
` $('#modal').classList.add('open');say(o.title||cname(e,f),o.voice||[e.c]);`);
rep(`function closeModal(){$('#modal').classList.remove('open')}`,
`function closeModal(){$('#modal').classList.remove('open');stopVoice()}`);

// 9. 启动：声音按钮、Service Worker
rep(`$('#logoSvg').innerHTML=creatureSVG(BY['火']||ALL[0],2);`,
`$('#logoSvg').innerHTML=creatureSVG(BY['火']||ALL[0],2);
$('#snd').onclick=toggleVoice;$('#snd').textContent=voiceOn()?'🔊':'🔇';$('#snd').setAttribute('aria-pressed',voiceOn());
if('serviceWorker'in navigator&&location.protocol.startsWith('http')){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}`);

fs.writeFileSync(file, h);
console.log('index.html 已改造完成，大小', h.length);
