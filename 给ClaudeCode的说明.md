# 字灵乐园：给 Claude Code 的说明

这个文件夹里是「字灵乐园」汉字/拼音笔顺小游戏的全部内容：

- `index.html`：游戏本体，单个网页文件。字表、拼音字母笔顺数据、字灵卡片绘制、星星奖励、卡册、全班海报都在里面。双击就能在浏览器里打开。
- `字灵卡-打印版.pdf`：可打印的字灵卡（63×88 毫米，每页 9 张，共 300 张）。

## 技术情况
- 汉字笔顺用开源库 Hanzi Writer（MIT 许可，笔画数据为 Arphic 公共许可），从 cdn.jsdelivr.net 加载。
- 字体从 Google Fonts 加载（ZCOOL KuaiLe、Andika）。
- 所以现在需要联网才能完整使用。
- 孩子的进度存在浏览器的 localStorage 里，每台设备各自独立。

## 目标
1. 做成免费网站：例如部署到 GitHub Pages 或 Netlify / Cloudflare Pages，生成一个任何人都能打开、不需要登录的网址。
2. 做成可下载的离线成品：把 Hanzi Writer 和字体下载到本地，改成相对路径引用，让整个文件夹打包成 zip 后，断网也能双击 index.html 使用。
