# 字灵乐园：给 Claude Code 的说明

「字灵乐园」是汉字 / 拼音笔顺小游戏。2026-10-07 起已经是一个完整的、全本地化的静态网站，并发布在 GitHub Pages：

- 网址：https://yu-jin-ku.github.io/zilin-leyuan/
- 仓库：https://github.com/Yu-Jin-KU/zilin-leyuan （GitHub 账号 Yu-Jin-KU，本机 `gh` 已登录）
- 本地目录就是仓库工作区：改完 `git commit` + `git push`，一两分钟后网站自动更新。

## 目录

- `index.html`：游戏本体（字表、字灵绘制、卡册、海报、语音播放逻辑全在里面）。
- `audio/`：Fish Audio 预生成的语音，`<字>.mp3` 和 `ui_*.mp3`（32 kbps 单声道）。
- `data/`：每个字的笔顺 JSON（hanzi-writer-data，Arphic 许可）；本地找不到时才退回 jsDelivr。
- `lib/hanzi-writer.min.js`、`fonts/`（站酷快乐体 / Andika 子集 woff2）：不再依赖任何 CDN。
- `sw.js` + `manifest.webmanifest` + 图标：Service Worker 离线缓存、可“添加到主屏幕”。
- `tools/gen_audio.py`：批量生成语音（见下）；`tools/patch_index.js` 是一次性改造脚本，已执行过，留作记录。
- `字灵卡-打印版.pdf`：300 张可打印字灵卡。

## 语音怎么来的

- Fish Audio 免费模型 `s2.1-pro-free`（官方说明免费到 2026-11-30，之后可能收费：s2.1-pro 为 15 美元 / 百万字节，整套字表约 10 万字节，即不到 2 美元）。
- 音色：公共声音「温柔动听女声」`faccba1a8ac54016bcfc02761285e67f`，语速 0.88。单字后面带了拼音注音标签，保证多音字按字表里的拼音读。
- 密钥通过环境变量 `FISH_API_KEY` 传入，**不要写进仓库**。换声音：删掉 `audio/`，`python tools/gen_audio.py --voice <id>`，约 45 分钟。
- 浏览器端用 Web Audio 解码播放；mp3 缺失 / 离线未缓存时自动退回系统朗读。

## 已知可以继续做的事

- 国内访问：github.io 时通时断。可把同一文件夹再部署一份到腾讯 EdgeOne Pages（`*.edgeone.app` 国内可达、免费、不需要备案）。
- 玩家进度只在本机 localStorage，没有导出 / 导入；年级名「0年级…15年级」对孩子不直观；丹麦语释义可做成多语言切换。
