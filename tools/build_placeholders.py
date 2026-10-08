# -*- coding: utf-8 -*-
"""用 Kenney Monster Builder（CC0）零件给 24 个部落拼出占位立绘：蛋 + 三段进化 = 96 张，输出到 art/_raw/。
Gemini 画好的正式立绘放进 art/_raw/ 同名覆盖即可；之后运行 python tools/pack_art.py。

用法：python tools/build_placeholders.py --parts <Kenney PNG/Double 目录> --icons <Fluent 3D 图标目录>
"""
import sys, io, json, argparse, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, ImageFilter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--parts", required=True); ap.add_argument("--icons", required=True)
ap.add_argument("--out", default=str(ROOT / "art" / "_raw"))
args = ap.parse_args()
P, ICONS, OUT = Path(args.parts), Path(args.icons), Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
T = json.loads((ROOT / "tools" / "tribes.json").read_text(encoding="utf-8"))["tribes"]
TYPE_COL = {"sky": "#5AB6FF", "fire": "#FF6B35", "wood": "#4CC35A", "earth": "#C89B5E", "water": "#3FA9F5", "heart": "#FF7FA8", "letter": "#FFD23F"}

# 部落 -> (身体, 颜色, 眼睛, 嘴, 手臂, 腿, 二段配件, 三段配件, 眼睛数, 图标)
R = {
 "sun":   ("B","yellow","eye_cute_light","mouth_closed_happy","A","A","ear_round","horn_small",2,"sun_3d"),
 "wind":  ("A","white","eye_blue","mouthB","B","B","antenna_small","antenna_large",2,"cloud_with_rain_3d"),
 "bird":  ("E","blue","eye_cute_dark","mouthA","C","C","ear","horn_small",2,"bird_3d"),
 "stroke":("C","dark","eye_human","mouth_closed_happy","D","D","antenna_small","antenna_large",1,"pencil_3d"),
 "fire":  ("D","red","eye_red","mouthC","E","E","horn_small","horn_large",2,"fire_3d"),
 "metal": ("F","yellow","eye_human_blue","mouth_closed_teeth","A","B","antenna_small","antenna_large",1,"bell_3d"),
 "blade": ("C","red","eye_human_red","mouth_closed_fangs","C","A","horn_small","horn_large",2,"dagger_3d"),
 "plant": ("A","green","eye_cute_light","mouthD","B","C","ear","antenna_small",2,"seedling_3d"),
 "grain": ("B","green","eye_human_green","mouth_closed_happy","D","E","ear_round","horn_small",2,"sheaf_of_rice_3d"),
 "beast": ("E","green","eye_yellow","mouthE","E","D","ear","horn_large",2,"bug_3d"),
 "stone": ("F","dark","eye_human","mouth_closed_teeth","A","A","horn_small","horn_large",2,"rock_3d"),
 "home":  ("D","yellow","eye_cute_dark","mouthF","B","B","ear_round","antenna_small",2,"house_3d"),
 "field": ("B","dark","eye_human_green","mouthG","C","C","horn_small","horn_large",2,"ox_3d"),
 "sea":   ("A","blue","eye_cute_light","mouthH","D","D","antenna_small","antenna_large",2,"water_wave_3d"),
 "fish":  ("E","blue","eye_blue","mouthI","E","E","ear_round","horn_small",1,"fish_3d"),
 "food":  ("F","white","eye_cute_dark","mouthJ","A","B","ear","ear_round",2,"dumpling_3d"),
 "heart": ("C","red","eye_closed_happy","mouth_closed_happy","B","C","ear_round","antenna_small",2,"red_heart_3d"),
 "people":("D","white","eye_human","mouthA","C","D","ear","horn_small",2,"busts_in_silhouette_3d"),
 "mouth": ("A","red","eye_cute_light","mouthE","D","E","ear_round","horn_small",2,"mouth_3d"),
 "hand":  ("B","yellow","eye_human_blue","mouthB","E","A","antenna_small","horn_small",2,"raised_hand_3d"),
 "body":  ("C","white","eye_human_blue","mouth_closed_happy","A","B","ear","ear_round",1,"eye_3d"),
 "cloth": ("E","red","eye_cute_dark","mouthC","B","C","ear_round","antenna_large",2,"t-shirt_3d"),
 "jade":  ("F","green","eye_human_green","mouth_closed_happy","C","D","horn_small","horn_large",2,"gem_stone_3d"),
 "pinyin":("D","yellow","eye_blue","mouthD","D","E","antenna_small","antenna_large",1,"robot_3d"),
}
def part(name): return Image.open(P / f"{name}.png").convert("RGBA")
def fit_h(im, h): return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
def fit_w(im, w): return im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
def hexrgb(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))

def monster(tid, stage):
    body, col, eye, mouth, arm, leg, d2, d3, neyes, _ = R[tid]
    cv = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    H = {1: 230, 2: 300, 3: 330}[stage]
    b = fit_h(part(f"body_{col}{body}"), H); bw, bh = b.size
    cy = 512 - 60 - bh // 2 if stage > 1 else 300
    bx, by = 256 - bw // 2, cy - bh // 2
    if stage == 3:   # 光环
        aura = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); d = ImageDraw.Draw(aura)
        c = hexrgb(TYPE_COL[next(t["type"] for t in T if t["id"] == tid)])
        d.ellipse([256 - bw * .75, cy - bh * .72, 256 + bw * .75, cy + bh * .72], fill=c + (90,))
        cv.alpha_composite(aura.filter(ImageFilter.GaussianBlur(22)))
    if stage >= 2:   # 腿和手臂在身体后面
        lg = fit_h(part(f"leg_{col}{leg}"), int(bh * .55)); lw, lh = lg.size
        for sx, img in ((-1, lg), (1, ImageOps.mirror(lg))):
            cv.alpha_composite(img, (int(256 + sx * bw * .22 - lw / 2), int(by + bh - lh * .25)))
        ar = fit_h(part(f"arm_{col}{arm}"), int(bh * .62)); aw, ah = ar.size
        cv.alpha_composite(ar, (int(bx - aw * .55), int(by + bh * .3)))
        cv.alpha_composite(ImageOps.mirror(ar), (int(bx + bw - aw * .45), int(by + bh * .3)))
    # 配件（角 / 天线 / 耳朵）在身体后面
    dets = [d2] if stage == 2 else [d2, d3] if stage == 3 else []
    for i, dn in enumerate(dets):
        dt = fit_h(part(f"detail_{col}_{dn}"), int(bh * (.34 if "large" in dn else .26))); dw, dh = dt.size
        if "antenna" in dn:
            cv.alpha_composite(dt, (int(256 - dw / 2 + (i * 28 - 14)), int(by - dh * .8)))
        else:
            cv.alpha_composite(dt, (int(bx - dw * .3), int(by + bh * .05)))
            cv.alpha_composite(ImageOps.mirror(dt), (int(bx + bw - dw * .7), int(by + bh * .05)))
    cv.alpha_composite(b, (bx, by))
    ey = fit_w(part(eye), int(bw * (.3 if neyes == 1 else .24))); ew, eh = ey.size
    if neyes == 1: cv.alpha_composite(ey, (256 - ew // 2, int(by + bh * .3 - eh / 2)))
    else:
        for sx in (-1, 1): cv.alpha_composite(ey, (int(256 + sx * bw * .17 - ew / 2), int(by + bh * .33 - eh / 2)))
    mo = fit_w(part(mouth), int(bw * .42)); mw, mh = mo.size
    cv.alpha_composite(mo, (256 - mw // 2, int(by + bh * .62 - mh / 2)))
    if stage == 3:   # 小皇冠
        d = ImageDraw.Draw(cv); cw = int(bw * .34); x0 = 256 - cw // 2; y1 = by - 6; y0 = y1 - int(cw * .55)
        d.polygon([(x0, y1), (x0, y0 + cw * .2), (x0 + cw * .25, y0 + cw * .4), (x0 + cw * .5, y0), (x0 + cw * .75, y0 + cw * .4), (x0 + cw, y0 + cw * .2), (x0 + cw, y1)], fill=(255, 199, 44), outline=(224, 168, 0), width=4)
        for k in (0, .5, 1): d.ellipse([x0 + cw * k - 8, y0 + (0 if k == .5 else cw * .2) - 8, x0 + cw * k + 8, y0 + (0 if k == .5 else cw * .2) + 8], fill=(255, 92, 138))
    return cv

def egg(tid):
    col = hexrgb(TYPE_COL[next(t["type"] for t in T if t["id"] == tid)])
    cv = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); d = ImageDraw.Draw(cv)
    d.ellipse([150, 330, 362, 400], fill=(0, 0, 0, 40))                       # 影子
    d.ellipse([112, 60, 400, 400], fill=(255, 246, 229), outline=col, width=14)
    d.ellipse([160, 110, 230, 210], fill=(255, 255, 255, 160))                 # 高光
    for (x, y, r) in ((300, 300, 26), (190, 300, 18), (330, 190, 14)): d.ellipse([x - r, y - r, x + r, y + r], fill=col + (110,))
    ic = Image.open(ICONS / f"{R[tid][9]}.png").convert("RGBA").resize((150, 150), Image.LANCZOS)
    cv.alpha_composite(ic, (256 - 75, 160))
    return cv

n = 0
for t in T:
    tid = t["id"]
    egg(tid).save(OUT / f"egg_{tid}.png"); n += 1
    for s in (1, 2, 3): monster(tid, s).save(OUT / f"tribe_{tid}_{s}.png"); n += 1
# 预览拼图
sheet = Image.new("RGBA", (4 * 256, len(T) * 256), (255, 255, 255, 255))
for i, t in enumerate(T):
    for j, name in enumerate([f"egg_{t['id']}"] + [f"tribe_{t['id']}_{s}" for s in (1, 2, 3)]):
        sheet.alpha_composite(Image.open(OUT / f"{name}.png").resize((256, 256)), (j * 256, i * 256))
sheet.convert("RGB").save(ROOT / "设计" / "部落占位立绘预览.jpg", quality=80)
print(f"生成 {n} 张占位立绘 -> {OUT}；预览 设计/部落占位立绘预览.jpg")
