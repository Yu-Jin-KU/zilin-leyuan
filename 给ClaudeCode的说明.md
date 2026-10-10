# 字灵乐园：给 Claude Code 的说明

「字灵乐园」是汉字 / 拼音笔顺小游戏，已发布在 GitHub Pages：

- 网址：https://ziling.danpicbook.com/
- 仓库：https://github.com/Yu-Jin-KU/zilin-leyuan （GitHub 账号 Yu-Jin-KU，本机 `gh` 已登录）
- 本地目录就是仓库工作区：改完 `git commit` + `git push`，一两分钟后网站自动更新。

## 目录

- `index.html`：游戏本体。字表 DATA、拼音表 PINYIN、英文释义 EN、HSK 表 HSK 都内嵌在里面（由 `tools/patch_*.js` 从 `tools/*.json` 注入过，之后直接改 index.html 即可）。
- `audio/`、`audio/kid/`：成人声 / 童声语音，`<字>.mp3` 和 `ui_*.mp3`（32 kbps 单声道）。（本机备份，不进 git；线上用 MEDIA/MEDIA2 托管地址）
- `data/`：笔顺 JSON（hanzi-writer-data，Arphic 许可）。拼音复合音节（zh、ang、yuan…）没有现成数据，由 `letterData()` 把单个字母的笔画拼接而成。
- `lib/`、`fonts/`：不依赖任何 CDN。`sw.js` 离线缓存，改了核心文件记得把 VERSION 加一。
- 家庭码云端备份（2026-10-09）：`sync/` 是 Cloudflare Worker + D1（`wrangler.toml`、`schema.sql`、`src/index.js`），接口 POST /new、GET/PUT /f/:code，服务器端按每个字取最高星合并，只存 {玩家id:{name,prog}}，不存画作和任何联系方式。前端在 index.html 的 `SYNC_API` 常量：为空则整个功能隐藏；填上 Worker 地址后 save() 会 4 秒防抖自动同步，选人页显示家庭码 + 二维码（lib/qrcode.min.js）+ 「找回进度」输入框，`?fam=CODE` 打开即恢复。本地联调：`cd sync && npx wrangler d1 execute zilin-sync --local --file=schema.sql && npx wrangler dev --port 8787 --local`，把 SYNC_API 临时指向 http://127.0.0.1:8787。部署：`npx wrangler login`（需在浏览器里登录拥有目标账号的 Cloudflare 用户）→ `npx wrangler d1 create zilin-sync`（把 database_id 填进 wrangler.toml）→ `npx wrangler d1 execute zilin-sync --remote --file=schema.sql` → `npx wrangler deploy`。
- 2026-10-10：拼音成人声 61 条改用老师本人录音（tools/_我的声音/金玉声音.mp3，切分脚本在会话 scratchpad voice/build_pinyin.py；ui、un 仍是合成的，因为老师说自己读得不准）。老师的声音已在 Fish 克隆为私有音色 50e0df03…（gen_audio.py 里叫 teacher），试听片段在 tools/_试听_克隆/；若老师满意，可 `python tools/gen_audio.py --voice teacher --out audio` 把整套成人声换成她的声音。拼音语音改成「一声读音 + 例句」（pinyin.json 的 sent/word）。老师版建班需邀请码（Worker secret TEACHER_INVITE）。写字页加了「上一个」。
- 2026-10-10 凌晨：教师版第一版。后端在 sync/src/index.js 的 classes()（表 cls / mem，建表脚本 schema_class.sql，已在远程 D1 执行并部署）：POST /c/new → {code,key}；GET /c/:code 公开拿班名和本周生字；PUT /c/:code/members 学生设备汇总（成员 id = 家庭码.玩家id，每班最多 60 人）；report / assign / DELETE m/:id 都要 ?key=老师钥匙。前端：teacher.html（独立页面，钥匙存 localStorage `zilin_teacher`，按年级选字用 data/grades.json）；index.html 里 S.cls={玩家id:班级码}、S.clsInfo 缓存班名和作业，syncClasses() 挂在 syncNow 之后每班一次请求，首页 grades() 顶部 .hw 横幅显示老师留的字，家长看这里多了「加入班级」一步，支持 ?cls=CODE 直达加入、?cards=山水火 打印指定字卡。还没做：教材课次预置字表、老师改班名、学生端离开班级时同步删除服务器成员（现在只能老师移除）。
- 2026-10-09 深夜：许可改为代码 PolyForm Noncommercial 1.0.0 + 内容 CC BY-NC-SA 4.0（LICENSE），之前 MIT 版本不受影响；家庭码备份改成攒 45 秒再传、页面隐藏时用 keepalive 立刻补传（Cloudflare 免费档 10 万请求/天，这样一次游戏只占一两次）。
- 2026-10-09 深夜：字义功能。`tools/meaning.tsv`（字 / 小朋友版解释 / 两个词 / 可选表情）是唯一的源，2026-10-09 深夜已覆盖拼音级到六年级共 2324 个字（七年级以上和进阶还没有）；改完后用同一段脚本重生成 `data/meaning.json`（格式 {字:[解释,[词,词]]}）并把表情合并进 index.html 的 EMOJI（看图认字游戏共用）。写字页有条目才显示「🔍 什么意思」，展开时朗读 `audio/m_<字>.mp3`（两种声音，phrases.py 的 meaning_phrases 生成文本：注音标签 + 解释 + 词），缺文件时退回浏览器 TTS。往后扩到三年级以上：在 tsv 里加行，跑 gen_audio.py 两种声音即可。
- 2026-10-09 晚：选人页加了「家长看这里」弹窗（`parentGuide`）：① 加到主屏幕（`beforeinstallprompt` 一键安装 / iOS 文字说明 / 已 standalone 则打勾）；② 按级别离线下载（`offlineUrls`：data + 两种语音 + ui 提示音 + 4 首音乐，走 fetch 让 sw 缓存，sw 没接管时自己 put 进 `zilin-*` 缓存）；③ 家庭码「发给自己」（`famShare` 用 navigator.share，退回 `famCopy` 剪贴板 + execCommand）；⏰ `S.limit`（默认 20 分钟，0 不限）配合 `tickPlay` 每 15 秒累计可见且 90 秒内有触摸的时间，到点 `showRest` 全屏休息 `REST_MIN`=10 分钟，`S.restUntil` 存本地所以刷新躲不掉，家长答乘法题解锁。sw 升到 v7。
- 2026-10-09 实测：Chrome/Edge 下 file:// 打开 index.html 时 fetch 被拦（笔顺 data/ 和语音 audio/ 都加载不出来），所以离线只能靠 PWA 缓存或本地 http 服务；README 和发布说明已改口。若要真正支持双击打开，需把 data/ 镜像成 `<script>` 可加载的 js、语音改走 `<audio>` 元素。
- `tools/phrases.py`：所有要朗读的文本（字 + 注音标签 + 诗句；拼音读音 + 儿歌；提示语），gen / qa 共用。拼音项的读音用 `pinyin.json` 里的 `tag`（Fish 注音标签，一律一声：教拼音用一声音阶，2026-10-08 用户要求），儿歌里的字母串各按自己的 tag 读；`say` 只用于屏幕显示和无语音时的兜底。字母 i/j/ü 的点在 HDATA 里改成了正圆（原来是斜的，像四声符号）。
- `tools/gen_audio.py`：生成语音；`tools/qa_audio.py`：用本地 faster-whisper 听写比对，找漏读乱读；`tools/pinyin.json`、`en_gloss.json`、`hsk30_chars.json`：数据源。
- `设计/字灵卡美术方案.md` + `prompts_一年级.csv`：给 Gemini 出图的方案和 1161 条提示词；`tools/make_prompts.py` 可重新生成。
- `tools/index.before-patch.html`、`index.before-v2.html`：两轮改造前的备份（已 gitignore）。

## 语音

- Fish Audio 免费模型 `s2.1-pro-free`（官方博客：免费到 2026-11-30）。密钥只通过环境变量 `FISH_API_KEY` 传入，不要写进仓库。
- 成人声「温柔动听女声」`faccba1a8ac54016bcfc02761285e67f`；童声「童声·讲故事」`8ab237c79d36417e84030674b8ab4cfd`。
- 童声是微软 Xiaoyou（美人鱼课绘本旁白所用的 Azure `zh-CN-XiaoyouNeural`）的克隆：参考音频取自 `D:\美人鱼课\绘本_十二生肖\pilot_鼠\audio_zh\00-04.mp3`，用 `client.voices.create()` 建成私有模型 `27bbdacb95f6449a806dd4a9ac85aba9`（在用户的 Fish 账号下）。Edge 免费端点已经下架 Xiaoyou（2026-10 只剩 6 个 zh-CN 音色），所以不能再用 edge-tts 生成新的参考音频。不要克隆真实学生的录音。
- 背景音乐：`music/` 下是 Kevin MacLeod 的 CC BY 4.0 曲目（压成 64 kbps 单声道），`music/CREDITS.txt` 是署名。网页里 `playMusic()` 按视图选曲（写字页用安静的 Carefree），`duck()` 在人声播放时压低到 0.05；另有 `startGen()` 用 Web Audio 即兴生成大调小曲作为第二选项。
- 模型偶尔会把短句读成十几秒胡话或漏字，所以每次生成后用 `qa_audio.py` 过一遍，`gen_audio.py --redo` 重做可疑条目。

## 闯关小游戏（index.html 里 `GAMES` 对象）

- 借鉴丹麦 ABC 教材（照片在 `丹麦语教材借鉴/`，已 gitignore）：每个音用多条通道重复。五种小游戏：listen 听音选字、picture 看图认字（emoji 表 `EMOJI`）、fill 填一填（拼音项：补声母 / 韵母 / 整体认读；汉字：补句子里的字）、maze 字迷宫（5×5，右/下随机生成保证可达）、sentence 拼句子。
- `quest(list,{daily,pool})` 是独立视图；`daily()` 从当前年级抽 5 个学过的字。通过记录在 `player.quest[字]`，瓷砖左上角显示 🎖。
- 拼音项的干扰项来自同一拼音分组；汉字来自同年级。填拼音的目标字取一到三年级里拼音含该音的字（`fillTargets`）。
- color 涂色显字（`inkMask()` 把字渲染到小画布取墨迹格子，涂完目标格子显出字形）、find 找形近字（`LOOK_HZ` / `LOOK_PY` 手工形近表 + 同年级同笔画兜底）。
- `draw(c)` 画板视图：作品以 256px JPEG dataURL 存在 `player.art[字]`，卡册顶部"我的画"和卡片弹窗会显示；localStorage 存满时提示删画。
- 立绘接入位：`art/manifest.json` 列出已有的 `<字>_<星>.webp`，`mascotHTML()` 有图用图、没图用程序怪兽。Gemini 出图后把 PNG 放到 `art/_raw/` 跑 `python tools/pack_art.py`。

## 奖励系统：字系 → 部落 → 部首（2026-10-08 起）

- 数据：`tools/tribes.json`（24 个部落、各自的部首列表、造型说明 look）、`tools/_mmah_dictionary.txt`（makemeahanzi 字典，提供每个字的部首，Arphic 许可）、`tools/_tribe_map.json`（字 → 部落），由 `tools/patch_v3.js` 注入成 `TRIBES / TRIBE_IDX / RADS`。
- 进度全部从 `player.prog` 推导（`tribeStats()`），没有新存档字段，老玩家自动换算。阈值 `STAGES=[3,15,40]`：孵化 / 进化 / 大王。
- 每个字的奖励是 `charCardSVG()` 排版字卡：笔画 ≤4 普通、5-8 稀有、9-12 史诗、13+ 传说（边框），星级另外显示。旧的 `creatureSVG / cardSVG` 保留，作为部落字灵没有立绘时的占位。
- 立绘接入位：`art/tribe_<id>_<1|2|3>.webp` 和 `art/egg_<id>.webp`，`tribeInner()` 优先用图。提示词 `设计/prompts_部落.csv`。
- 卡册有"字卡 / 部落"两页；海报改为"字灵王国"，24 只部落字灵按字系分区、按这台设备上所有人的喂养量长大（标题和口吻按人数自动切换：1 人「X 的王国 / 你已经」，2–5 人「我们的 / 大家一起」，6 人以上「全班的 / 全班一起」）；点字灵或部落卡上的按钮会按部落筛选选字页（`S.tfb`）。
- 打印版 PDF 已于 2026-10-08 用新字卡重做：`index.html?print=N` 会把前 N 号字卡（三星）铺进 #print 且不弹打印框，用无头 Chrome `--headless=new --no-pdf-header-footer --virtual-time-budget=20000 --print-to-pdf=… http://127.0.0.1:8931/index.html?print=300` 导出（要先起本地 http 服务，file:// 下字体加载不出来）。

## 设计决策

- 级别名：拼音 / 一到九年级 / 进阶一到六（丹麦学制没有 10 年级以上的叫法）；另有 HSK 3.0 视图。
- 编号 No. 保持最初的 26 字母 + 汉字顺序，新加的拼音排在最后，以免和打印版 PDF 的编号对不上。
- 语音减少重复：开场提示只在每次打开网页后说一次；完成时的夸奖在 8 句里轮换。
- 书写：笔画宽度 40/44，鼠标设备判定宽松 15%；错两次后下一笔用亮粉色高亮并持续提示。

## 语音 / 绘本托管（2026-10-10 起）

- 语音和绘本页的图片、旁白不再从 GitHub Pages 读，改从 Cloudflare Workers 静态资源读（账号 danpicbook@gmail.com，请求不限量、免费）：
  - `https://zilin-media.zilingleyuan.workers.dev/`：`kid/<字>.mp3` 童声全套；`book/<主题>/<页>.webp` 绘本配图（1024 宽）；`book/<主题>/<页>.<zh|en|da>.mp3` 每页旁白（不带配乐）。
  - `https://zilin-media2.zilingleyuan.workers.dev/`：`adult/`、`teacher/` 两套隐藏声音。
  - 每个 Worker 静态文件上限 2 万个，所以分两个。地址写在 index.html 的 `MEDIA` / `MEDIA2`。
- 构建：`python -X utf8 tools/build_media.py` 把 audio/ 三套和 D:\美人鱼课\绘本_*\ 的 assets、audio/{zh,en,da} 整理到 `_media/`（不进 git，可断点续跑）；然后 `cd media && npx wrangler deploy`、`cd media2 && npx wrangler deploy`（只上传有变化的文件）。
- 新生成或改了语音后：先跑 gen_audio，再 build_media + deploy。
- 绘本目录 `data/books.json` 由 `tools/build_books.py` 生成：每本书每页的文字、有哪些语言旁白、有没有配图，以及「字 / 拼音 → 哪本书哪一页」的索引（规则见脚本开头）。字页 / 拼音页的「📖 绘本里的…」、动画页的「翻书听故事」、阅读器（视图 `book`，自动连播、中英丹切换、读完接着下一本）都用它。
- 2026-10-10 起 audio/ 不再进 git（.gitignore），文件仍留在本机 audio/ 做原始备份，build_media.py 和 gen_audio.py 照旧读写它；页面只从托管地址加载。历史提交里仍有旧音频，要彻底清掉得重写历史（未做）。
- 绘本 / 连播正文和字页绘本块的中文用楷体（var(--kai)，LXGW WenKai 子集 6806 字，覆盖做完的书里除 晞曈焜 外全部字）；英 / 丹用 Andika。

## 用量预警 / 每日上限（2026-10-10 起）
- 只有 zilin-sync Worker 的请求计入免费额度（每天 10 万次）；静态资源（音频、配图、books.json）不计。Worker 抽样计数（D1 表 usage），cron 每 30 分钟检查，60% / 90% / 100% 各推送一次（Web Push，订阅存 D1 表 push，`POST /push/sub?key=邀请码`）。
- 用量行和「🔔 推送提醒」入口只给作者看：乐园或老师页带 `?teacher=1` 打开一次（localStorage `zilin_testvoice`），或在「家长看这里」的标题上连点 5 下（iPad 主屏幕版只能这样），之后「家长看这里」最下面出现「老师 / 作者选项」，老师页统计下面出现用量和推送行。iPad 只能在主屏幕版里订阅推送。
- 云端备份攒批 120 秒（`scheduleSync`），一直玩的孩子每小时最多 30 次同步（在班里的孩子一次同步 = 家庭 1 次 + 班级 1 次请求）。
- 每日上限 `DAILY_MIN`（index.html，默认 0 = 关）：按孩子（S.cur）累计当天活跃时长 `S.dayMs`，到了弹「今天玩得够多啦，明天再来」，家长算术解锁后当天不再限；老师模式不受限。要收费 / 免费名单时再把上限和名单放到 Worker 里按班级下发。
