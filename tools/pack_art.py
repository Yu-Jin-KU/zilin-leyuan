# -*- coding: utf-8 -*-
"""把 Gemini 画好的立绘整理进 art/：PNG/JPG -> 512×512 WebP（尽量去白底），并重写 art/manifest.json。
用法：python tools/pack_art.py [--src art/_raw]
文件名要求：<字>_<星级>.png，例如 山_3.png、b_2.png。"""
import sys, io, json, re, argparse
from pathlib import Path
from PIL import Image
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--src", default="art/_raw"); args = ap.parse_args()
SRC, OUT = ROOT / args.src, ROOT / "art"
SRC.mkdir(parents=True, exist_ok=True)

def unwhite(im, thr=240):
    """白底变透明（Gemini 不给透明背景时的兜底）"""
    im = im.convert("RGBA"); px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > thr and g > thr and b > thr: px[x, y] = (r, g, b, 0)
    return im

n = 0
for f in sorted(SRC.glob("*")):
    m = re.fullmatch(r"(.+)_([123])\.(png|jpg|jpeg|webp)", f.name, re.I)
    if not m: continue
    im = Image.open(f)
    if im.mode != "RGBA" or im.getchannel("A").getextrema() == (255, 255): im = unwhite(im)
    bbox = im.getbbox()
    if bbox: im = im.crop(bbox)
    side = max(im.size); sq = Image.new("RGBA", (side, side), (0, 0, 0, 0)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq = sq.resize((512, 512), Image.LANCZOS)
    sq.save(OUT / f"{m.group(1)}_{m.group(2)}.webp", "WEBP", quality=82, method=6); n += 1
keys = sorted(p.stem for p in OUT.glob("*.webp"))
(OUT / "manifest.json").write_text(json.dumps(keys, ensure_ascii=False), encoding="utf-8")
print(f"转换 {n} 张，manifest 共 {len(keys)} 个立绘")
