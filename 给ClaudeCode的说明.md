# 字灵乐园：给 Claude Code 的说明

「字灵乐园」是汉字 / 拼音笔顺小游戏，已发布在 GitHub Pages：

- 网址：https://yu-jin-ku.github.io/zilin-leyuan/
- 仓库：https://github.com/Yu-Jin-KU/zilin-leyuan （GitHub 账号 Yu-Jin-KU，本机 `gh` 已登录）
- 本地目录就是仓库工作区：改完 `git commit` + `git push`，一两分钟后网站自动更新。

## 目录

- `index.html`：游戏本体。字表 DATA、拼音表 PINYIN、英文释义 EN、HSK 表 HSK 都内嵌在里面（由 `tools/patch_*.js` 从 `tools/*.json` 注入过，之后直接改 index.html 即可）。
- `audio/`、`audio/kid/`：成人声 / 童声语音，`<字>.mp3` 和 `ui_*.mp3`（32 kbps 单声道）。
- `data/`：笔顺 JSON（hanzi-writer-data，Arphic 许可）。拼音复合音节（zh、ang、yuan…）没有现成数据，由 `letterData()` 把单个字母的笔画拼接而成。
- `lib/`、`fonts/`：不依赖任何 CDN。`sw.js` 离线缓存，改了核心文件记得把 VERSION 加一。
- `tools/phrases.py`：所有要朗读的文本（字 + 注音标签 + 诗句；拼音读音 + 儿歌；提示语），gen / qa 共用。
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
- 卡册有"字卡 / 部落"两页；海报改为"字灵王国"，24 只部落字灵按字系分区、按全班喂养量长大；点字灵或部落卡上的按钮会按部落筛选选字页（`S.tfb`）。
- 打印版 PDF（300 张旧怪兽卡）已过时，待字灵立绘到位后用页内 printCards 重新导出。

## 设计决策

- 级别名：拼音 / 一到九年级 / 进阶一到六（丹麦学制没有 10 年级以上的叫法）；另有 HSK 3.0 视图。
- 编号 No. 保持最初的 26 字母 + 汉字顺序，新加的拼音排在最后，以免和打印版 PDF 的编号对不上。
- 语音减少重复：开场提示只在每次打开网页后说一次；完成时的夸奖在 8 句里轮换。
- 书写：笔画宽度 40/44，鼠标设备判定宽松 15%；错两次后下一笔用亮粉色高亮并持续提示。
