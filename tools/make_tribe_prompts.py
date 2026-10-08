# -*- coding: utf-8 -*-
"""生成 24 只部落字灵的 Gemini 出图提示词：设计/prompts_部落.csv（每只：蛋 + 三段进化 = 4 行，共 96 行）。
文件名规范：art/_raw/tribe_<id>_<stage>.png（stage 1/2/3）和 art/_raw/egg_<id>.png，然后 python tools/pack_art.py。"""
import sys, io, csv, json
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
T = json.loads((ROOT / "tools" / "tribes.json").read_text(encoding="utf-8"))

STYLE = ("Cute collectible monster character for a children's Chinese learning game. Style: clean 2D vector-like illustration, "
         "thick dark outline, flat colors with soft cel shading, big glossy eyes, rounded shapes, kawaii, consistent front 3/4 view, "
         "soft top-left lighting. Full body, centered, nothing cropped. Plain pure white background. No text, no letters, no watermark, no frame.")
PALETTE = {
    "sky": "sky blue #5AB6FF with cream white accents", "fire": "orange-red #FF6B35 with golden yellow accents",
    "wood": "grass green #4CC35A with warm brown accents", "earth": "sandy ochre #C89B5E with stone grey accents",
    "water": "aqua blue #3FA9F5 with translucent white accents", "heart": "pink #FF7FA8 with lilac accents",
    "letter": "lemon yellow #FFD23F with blue accents",
}
STAGE = {
    1: "Baby form: egg-shaped body, head is 60% of the body, stubby limbs or none, curious innocent expression, small and simple.",
    2: "Teen form: proper arms and legs, standing confidently, holds ONE small prop related to its tribe, cheerful expression, medium detail.",
    3: "King form: taller heroic proportions, a royal cape and a small crown, a glowing aura of its element behind it, proud smile, most detailed.",
}
rows = []
for t in T["tribes"]:
    pal = PALETTE[t["type"]]
    rows.append([f"art/_raw/egg_{t['id']}.png", t["name"], "egg",
                 f"{STYLE} A cute monster egg for the tribe '{t['name']}', main palette {pal}. Smooth egg with a soft pattern hinting at what is inside: {t['look']}. A few tiny cracks, sitting on a small nest. Same style as the reference images."])
    for s in (1, 2, 3):
        rows.append([f"art/_raw/tribe_{t['id']}_{s}.png", t["name"], s,
                     f"{STYLE} Main palette {pal}. {STAGE[s]} Character concept: {t['look']}. The three stages of this character must read as the same creature growing up. Same style as the reference images."])
out = ROOT / "设计" / "prompts_部落.csv"
with open(out, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["文件名", "部落", "阶段", "提示词"]); w.writerows(rows)
print(f"已生成 {out.relative_to(ROOT)}，共 {len(rows)} 条")
