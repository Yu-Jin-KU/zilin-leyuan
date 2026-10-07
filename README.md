# 字灵乐园 · 写字召唤小怪兽

免费的汉字 / 拼音笔顺小游戏。孩子先看一遍笔顺，再用手指或鼠标一笔一笔写；写对了就能"召唤"一只属于这个字的字灵，写得越好字灵进化得越厉害，还能把字灵卡打印出来、贴成全班海报。

- **6700 个汉字 + 26 个拼音字母**，按 16 个年级分组（一年级 300 字到全部通用规范字）
- **真人感中文语音**：每个字、每句诗 / 词语都有预先生成的语音（Fish Audio），不再是机器音
- **不用登录、没有广告、不收集任何数据**，进度只存在自己的设备里
- **可离线**：打开过一次以后，断网也能玩；也可以下载整个文件夹双击 `index.html` 使用
- 可打印的字灵卡（`字灵卡-打印版.pdf`，63×88 毫米）和全班海报

## 怎么用

直接打开网址即可（见仓库右侧 About 里的链接）。在平板上可以用浏览器菜单里的"添加到主屏幕"，就会像 App 一样全屏打开。

离线使用：点仓库页面绿色的 **Code → Download ZIP**，解压后双击 `index.html`。

## 文件说明

| 文件 / 目录 | 作用 |
|---|---|
| `index.html` | 游戏本体（字表、字灵绘制、卡册、海报都在里面） |
| `audio/` | 每个字 / 字母一段语音 `audio/<字>.mp3`，还有 `ui_*.mp3` 提示语 |
| `data/` | 每个字的笔顺数据（来自 hanzi-writer-data） |
| `lib/hanzi-writer.min.js` | 笔顺动画与书写判定库 |
| `fonts/` | 站酷快乐体、Andika 的子集字体 |
| `sw.js` `manifest.webmanifest` | 离线缓存与"添加到主屏幕" |
| `tools/gen_audio.py` | 用 Fish Audio 批量重新生成语音的脚本 |
| `字灵卡-打印版.pdf` | 300 张可打印字灵卡 |

## 重新生成语音 / 换声音

```powershell
$env:FISH_API_KEY = "你的 Fish Audio 密钥"
python -m pip install fish-audio-sdk
python tools/gen_audio.py                       # 只补缺的文件
python tools/gen_audio.py --voice <reference_id> # 换声音时先删掉 audio/ 再跑
```

默认用的是 Fish Audio 的免费模型 `s2.1-pro-free` 和公共音色「温柔动听女声」。在 fish.audio 网站上任何一个声音页面的网址 `fish.audio/m/<32位id>/` 里的那串 id 就是 `reference_id`。

## 致谢与许可

- 笔顺动画与判定：[Hanzi Writer](https://github.com/chanind/hanzi-writer)（MIT）
- 笔顺数据：[hanzi-writer-data](https://github.com/chanind/hanzi-writer-data)，源自 Make Me a Hanzi，Arphic 公共许可（见 `data/LICENSE-ARPHIC.txt`）
- 字体：站酷快乐体、Andika（SIL Open Font License，见 `fonts/`）
- 语音：由 [Fish Audio](https://fish.audio) 生成
- 游戏代码与字灵形象：MIT 许可，欢迎老师和家长自由分享、修改
