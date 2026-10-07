# -*- coding: utf-8 -*-
"""生成给 Gemini 出图用的提示词表：设计/prompts_一年级.csv（一年级 300 字 + 拼音 87 个，每个 3 段进化）。
用法：python tools/make_prompts.py [--grades 0,1]
字形拆解可以写在 tools/shape_hints.json（{"山": "three stone peaks rise from its head..."}），没有就只用字义。"""
import sys, io, csv, json, argparse
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from phrases import load_data, load_pinyin

ap = argparse.ArgumentParser(); ap.add_argument("--grades", default="0,1"); args = ap.parse_args()
grades = {int(g) for g in args.grades.split(",")}
EN = json.loads((ROOT / "tools" / "en_gloss.json").read_text(encoding="utf-8"))
hints_file = ROOT / "tools" / "shape_hints.json"
HINTS = json.loads(hints_file.read_text(encoding="utf-8")) if hints_file.exists() else {}

STYLE = ("Cute collectible monster card character for a children's Chinese learning game. "
         "Style: clean 2D vector-like illustration, thick dark outline, flat colors with soft cel shading, "
         "big glossy eyes, rounded shapes, kawaii, consistent front 3/4 view, soft top-left lighting. "
         "Full body, centered, nothing cropped. Plain pure white background, no text, no letters, no watermark, no frame.")
TYPE = {
    "sky": "Palette sky blue #5AB6FF and cream white; tiny wings and cloud-like feet.",
    "fire": "Palette orange-red #FF6B35 and golden yellow; a flame tuft on the head, a spark at the tail.",
    "wood": "Palette grass green #4CC35A and warm brown; leaf-shaped ears, twig-like arms.",
    "earth": "Palette sandy ochre #C89B5E and stone grey; a rocky back shell.",
    "water": "Palette aqua blue #3FA9F5 and translucent white; water-ripple marks and a bubble.",
    "heart": "Palette pink #FF7FA8 and lilac; fluffy fur, heart-shaped tail, blush cheeks.",
    "letter": "Palette lemon yellow #FFD23F and blue; a tiny robot body made of building blocks, with an antenna.",
}
STAGE = {
    1: "Baby form: egg-shaped body, head is 60% of the body, stubby limbs or none, curious innocent expression. Small and simple.",
    2: "Teen form: proper arms and legs, standing confidently, holds ONE small prop related to its meaning, cheerful expression. Medium detail.",
    3: "King form: taller heroic proportions, royal cape and a small crown, a glowing aura of its element behind it, proud smile. Most detailed.",
}

rows = []
py = load_pinyin()
for g in py["groups"]:
    for k in g["items"]:
        if 0 in grades:
            for st in (1, 2, 3):
                p = f"{STYLE} {TYPE['letter']} {STAGE[st]} Its body visually echoes the Latin letters \"{k}\" (pinyin {g['name']}). Do not draw any letter or text."
                rows.append([f"art/{k}_{st}.png", k, "letter", st, p])
for r in load_data():
    if r[8] not in grades: continue
    c, t = r[0], r[3]
    meaning = EN.get(c, "")
    hint = HINTS.get(c, "")
    for st in (1, 2, 3):
        sem = f"The character means \"{meaning}\"." if meaning else ""
        if hint: sem += f" Its body visually echoes the shape of the Chinese character {c}: {hint}"
        p = f"{STYLE} {TYPE.get(t, '')} {STAGE[st]} {sem} Do not draw any Chinese character or text."
        rows.append([f"art/{c}_{st}.png", c, t, st, p])

out = ROOT / "设计" / "prompts_一年级.csv"
with open(out, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["文件名", "字", "字系", "星级", "提示词"]); w.writerows(rows)
print(f"已生成 {out.relative_to(ROOT)}，共 {len(rows)} 条提示词（{len(rows)//3} 个字 × 3 段）")
