# 字灵乐园 · 写字召唤小怪兽

免费的汉字 / 拼音笔顺小游戏。孩子先看一遍笔顺，再用手指或鼠标一笔一笔写；写对一个字就得到一张字卡（笔画越多卡框越稀有），同时喂了这个字所属部落的字灵一口。全部汉字按部首分成 24 个部落（江海族、草木族、小人族、嘴巴族……），喂 3 个字孵化，15 个进化，40 个变成大王；集齐部落里所有部首徽章就是族长。全班一起喂养的字灵住在"字灵王国"海报里。

**在线玩：https://ziling.danpicbook.com/**（旧网址 yu-jin-ku.github.io/zilin-leyuan 会自动跳转）

- **6700 个汉字 + 63 个拼音**（声母、韵母、整体认读音节，按人教版一年级上册顺序），按 16 个级别分组，也可以切换成 **HSK 3.0 一到九级**
- **真人感中文语音**：每个字、每句诗 / 词语、每条拼音儿歌都有预先生成的语音（Fish Audio），可选成人声或童声
- **轻快背景音乐**：人声出现时自动变轻，写字时换成更安静的曲子；也可以选程序即兴生成的小调，或关掉
- 每个字带拼音、丹麦语和英文释义；拼音级到六年级的 2324 个字另有「🔍 什么意思」：一句小朋友听得懂的解释加两个常用词，由成人声 / 童声读出来，具体的字配一个表情图（文字在 `tools/meaning.tsv`，老师可直接改）
- **闯关小游戏**（借鉴丹麦字母教材的"一个音多条通道"）：听音选字、看图认字、填一填（补拼音 / 补句子里的字）、字迷宫、拼句子；每个字写完可以闯三关，首页有"今日闯关"随机抽 5 个学过的字
- **不用登录、没有广告**：进度存在自己的设备里，并用一个自动生成的 8 位「家庭码」备份到云端（只备份名字和每个字的星数，不收集任何联系方式）；换设备或浏览器数据被清掉时，在选人页输入家庭码或扫二维码就能找回
- **可离线**：选人页「家长看这里」里按级别一键下载（一年级约 12 MB），断网也能写；打开过的内容也会自动缓存；平板上「添加到主屏幕」后像 App 一样全屏打开。注意直接双击本地的 `index.html` 不行：浏览器不允许本地文件读取旁边的笔顺和语音文件，离线包要放在静态服务器或本地 http 服务下用
- **每次玩多久**：默认连续玩 20 分钟出现休息画面，休息 10 分钟才能继续（家长答一道乘法题可提前解锁）；可改成 15 / 30 分钟或不限
- 可打印的字灵卡（`字灵卡-打印版.pdf`，63×88 毫米）和「字灵王国」海报（一个人玩是自己的王国，一台设备多人用就是大家或全班的王国）

## 老师版（教室里用）

打开 [teacher.html](https://ziling.danpicbook.com/teacher.html) 新建一个班，会得到**班级码**（发给家长）和**老师钥匙**（只有老师留着）。家长在游戏的「家长看这里 → 加入班级」输入班级码，或直接打开老师页面上的加入链接；之后老师就能看到全班每个孩子写了哪些字、几颗星、最近什么时候玩过，还能布置「本周生字」（直接打字、或按年级点选），孩子一打开游戏首页就是老师留的字，写完一个亮一个。生字可以一键打印成字卡。学生端始终免费、不用注册；班里只存名字和每个字的星数。

## 怎么用

直接打开网址即可。右上角的喇叭可以切换成人声 / 童声 / 静音。选人页底部的「家长看这里」分三步设置：① 加到主屏幕（Android / 电脑 Chrome 一键安装，iPad 用分享按钮里的「添加到主屏幕」）；② 选一个级别「下载到这台设备」，之后没网也能写；③ 存好家庭码（「发给自己」弹出系统分享面板，或直接复制，内容里带一个点开就能找回进度的链接）。同一页可以设每次玩多久，教室用建议设成不限。

离线使用：「家长看这里」里按级别下载，或者打开过的内容自动缓存，之后不联网也能用。[Releases](../../releases) 里的 zip 是整站文件，给自建服务器或教室局域网用（例如解压后在文件夹里运行 `python -m http.server 8080`，再打开 http://localhost:8080 ）；直接双击 `index.html` 加载不出笔顺。

## 文件说明

| 文件 / 目录 | 作用 |
|---|---|
| `index.html` | 游戏本体（字表、字灵绘制、卡册、海报都在里面） |
| `sync/` | 云端后端（Cloudflare Worker + D1）：家庭码备份 + 老师版的班级、成员、本周生字，见文件头注释 |
| `teacher.html` `data/grades.json` | 老师版页面和它用的按年级字表（`tools/build_grades.py` 生成） |
| `audio/` `audio/kid/` | 成人声 / 童声语音，`<字>.mp3`，另有 `ui_*.mp3` 提示语 |
| `data/` | 每个字的笔顺数据（来自 hanzi-writer-data） |
| `lib/hanzi-writer.min.js` | 笔顺动画与书写判定库 |
| `fonts/` | 站酷快乐体、Andika 的子集字体 |
| `sw.js` `manifest.webmanifest` | 离线缓存与"添加到主屏幕" |
| `tools/` | 数据与语音脚本：`phrases.py`（朗读文本）、`gen_audio.py`（生成语音）、`qa_audio.py`（Whisper 质检）、`pinyin.json`（拼音表与儿歌）、`en_gloss.json`（英文释义）、`hsk30_chars.json`（HSK 字表） |
| `设计/` | 字灵卡美术方案和给 Gemini 的出图提示词表 |
| `字灵卡-打印版.pdf` | 前 300 号字卡（26 个字母 + 274 个常用字，63×88 毫米，A4 每页 9 张）；在浏览器里打开 `index.html?print=300` 再打印即可重新导出 |

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
- 字体：站酷快乐体（界面）、霞鹜文楷 LXGW WenKai（字卡、字块上的汉字，楷体字形）、Andika（拼音），都是 SIL Open Font License，见 `fonts/`
- 语音：由 [Fish Audio](https://fish.audio) 生成
- 背景音乐：Kevin MacLeod（[incompetech.com](https://incompetech.com)），CC BY 4.0，曲目见 `music/CREDITS.txt`
- 许可：代码为 PolyForm Noncommercial 1.0.0，字义文字、字灵形象、语音等内容为 CC BY-NC-SA 4.0（详见 `LICENSE`）。老师和家长可以自由分享、打印、改编用于教学；商业使用请先联系作者。网站本身对孩子、家长和老师永久免费
