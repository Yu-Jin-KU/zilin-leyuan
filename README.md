# 字灵乐园 · 写字召唤小怪兽

免费的汉字 / 拼音笔顺小游戏。孩子先看一遍笔顺，再用手指或鼠标一笔一笔写；写对了就能"召唤"一只属于这个字的字灵，写得越好字灵进化得越厉害，还能把字灵卡打印出来、贴成全班海报。

**在线玩：https://yu-jin-ku.github.io/zilin-leyuan/**

- **6700 个汉字 + 63 个拼音**（声母、韵母、整体认读音节，按人教版一年级上册顺序），按 16 个级别分组，也可以切换成 **HSK 3.0 一到九级**
- **真人感中文语音**：每个字、每句诗 / 词语、每条拼音儿歌都有预先生成的语音（Fish Audio），可选成人声或童声
- **轻快背景音乐**：人声出现时自动变轻，写字时换成更安静的曲子；也可以选程序即兴生成的小调，或关掉
- 每个字带拼音、丹麦语和英文释义
- **闯关小游戏**（借鉴丹麦字母教材的"一个音多条通道"）：听音选字、看图认字、填一填（补拼音 / 补句子里的字）、字迷宫、拼句子；每个字写完可以闯三关，首页有"今日闯关"随机抽 5 个学过的字
- **不用登录、没有广告、不收集任何数据**，进度只存在自己的设备里
- **可离线**：打开过一次以后，断网也能玩；也可以下载整个文件夹双击 `index.html` 使用
- 可打印的字灵卡（`字灵卡-打印版.pdf`，63×88 毫米）和全班海报

## 怎么用

直接打开网址即可。在平板上可以用浏览器菜单里的"添加到主屏幕"，就会像 App 一样全屏打开。右上角的喇叭可以切换成人声 / 童声 / 静音。

离线使用：到 [Releases](../../releases) 下载 zip，解压后双击 `index.html`。

## 文件说明

| 文件 / 目录 | 作用 |
|---|---|
| `index.html` | 游戏本体（字表、字灵绘制、卡册、海报都在里面） |
| `audio/` `audio/kid/` | 成人声 / 童声语音，`<字>.mp3`，另有 `ui_*.mp3` 提示语 |
| `data/` | 每个字的笔顺数据（来自 hanzi-writer-data） |
| `lib/hanzi-writer.min.js` | 笔顺动画与书写判定库 |
| `fonts/` | 站酷快乐体、Andika 的子集字体 |
| `sw.js` `manifest.webmanifest` | 离线缓存与"添加到主屏幕" |
| `tools/` | 数据与语音脚本：`phrases.py`（朗读文本）、`gen_audio.py`（生成语音）、`qa_audio.py`（Whisper 质检）、`pinyin.json`（拼音表与儿歌）、`en_gloss.json`（英文释义）、`hsk30_chars.json`（HSK 字表） |
| `设计/` | 字灵卡美术方案和给 Gemini 的出图提示词表 |
| `字灵卡-打印版.pdf` | 300 张可打印字灵卡 |

## 重新生成语音 / 换声音

```powershell
$env:FISH_API_KEY = "你的 Fish Audio 密钥"
python -m pip install fish-audio-sdk faster-whisper
python tools/gen_audio.py                 # 成人声，只补缺的文件
python tools/gen_audio.py --voice kid     # 童声
python tools/gen_audio.py --redo "一二三"  # 重做某几个字
python tools/qa_audio.py                  # 用 Whisper 听一遍，列出可疑条目
```

默认用 Fish Audio 的免费模型 `s2.1-pro-free`；成人声是公共音色「温柔动听女声」，童声是「童声·讲故事」。在 fish.audio 任何声音页面的网址 `fish.audio/m/<32位id>/` 里的 id 就是 `--voice` 可以填的值。

## 致谢与许可

- 笔顺动画与判定：[Hanzi Writer](https://github.com/chanind/hanzi-writer)（MIT）
- 笔顺数据：[hanzi-writer-data](https://github.com/chanind/hanzi-writer-data)，源自 Make Me a Hanzi，Arphic 公共许可（见 `data/LICENSE-ARPHIC.txt`）
- HSK 3.0 字表：[elkmovie/hsk30](https://github.com/elkmovie/hsk30)（MIT），依据教育部《国际中文教育中文水平等级标准》
- 英文释义：[CC-CEDICT](https://cc-cedict.org)（CC BY-SA 4.0）
- 字体：站酷快乐体、Andika（SIL Open Font License，见 `fonts/`）
- 语音：由 [Fish Audio](https://fish.audio) 生成
- 背景音乐：Kevin MacLeod（[incompetech.com](https://incompetech.com)），CC BY 4.0，曲目见 `music/CREDITS.txt`
- 游戏代码与字灵形象：MIT 许可，欢迎老师和家长自由分享、修改
