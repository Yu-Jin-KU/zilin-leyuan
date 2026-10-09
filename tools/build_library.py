# -*- coding: utf-8 -*-
r"""绘本 / 古诗 / 拼音视频目录：从 D:\美人鱼课\绘本工具\_autopost 的排期、台账和文案生成 data/library.json，
封面缩成 320px webp 放到 img/lib/。已上传的版本带 YouTube 链接；没上传的页面上显示「即将上线」，
并由页面在线匹配频道最新视频（Worker /yt）自动补上。
用法：python tools/build_library.py"""
import sys, json, re, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
AP = Path(r"D:\美人鱼课\绘本工具\_autopost")
sys.path.insert(0, str(AP))
import yt_copy  # noqa: E402
from PIL import Image  # noqa: E402

sched = json.loads((AP / "yt_schedule.json").read_text(encoding="utf-8"))
ledger = json.loads((AP / "yt_ledger.json").read_text(encoding="utf-8")).get("done", {})
LANG = {"中文版": "zh", "英文版": "en", "丹麦语版": "da", "儿歌MV": "mv"}
items, order = {}, []
for e in sched:
    theme, version = e["theme"], e["version"]
    if theme not in items:
        series = yt_copy.series_of(theme)
        zh, en, da = yt_copy.names_of(theme)
        zh = zh.replace("诗词版", "")   # 咏鹅诗词版 -> 咏鹅
        items[theme] = {"theme": theme, "series": series, "zh": zh, "en": en, "da": da, "versions": {}, "desc": e["desc"].split("】", 1)[-1].strip()[:120]}
        order.append(theme)
    r = yt_copy.yt_entry(e)
    title = r["title"] if isinstance(r, dict) else r[0]
    v = {"title": title}
    done = ledger.get(e["video"])
    if done and done.get("id"):
        v["id"] = done["id"]
    items[theme]["versions"][LANG.get(version, version)] = v
# covers -> img/lib/<n>.webp
out_img = ROOT / "img" / "lib"; out_img.mkdir(parents=True, exist_ok=True)
covers = AP / "covers"
for n, theme in enumerate(order):
    base = theme.replace("诗词版", "")
    cands = [covers / f"{theme}_中文版.jpg", covers / f"{theme}_横版_YouTube.jpg", covers / f"{theme}_横版_中文版.jpg"] + sorted(covers.glob(f"{theme}*.jpg")) + sorted(covers.glob(f"{base}_*.jpg"))
    src = next((c for c in cands if c.exists()), None)
    if src:
        im = Image.open(src).convert("RGB"); im.thumbnail((400, 400)); dst = out_img / f"{n:03d}.webp"; im.save(dst, "WEBP", quality=78, method=6)
        items[theme]["img"] = f"img/lib/{n:03d}.webp"
    items[theme]["n"] = n
lib = {"channel": "UC6JD2Ej48LIp_iLkkFN6Xqg", "handle": "DanPicBookKids", "items": [items[t] for t in order]}
(ROOT / "data" / "library.json").write_text(json.dumps(lib, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
from collections import Counter
c = Counter(i["series"] for i in lib["items"]); up = sum(1 for i in lib["items"] for v in i["versions"].values() if v.get("id"))
print(f"{len(order)} 个条目：{dict(c)}；已有链接的版本 {up} 个；封面 {sum(1 for i in lib['items'] if i.get('img'))} 张")
