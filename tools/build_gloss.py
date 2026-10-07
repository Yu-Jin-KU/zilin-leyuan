# -*- coding: utf-8 -*-
"""从 CC-CEDICT 为字表每个字挑一个简短英文释义，写到 tools/en_gloss.json。
用法：python tools/build_gloss.py <cedict_ts.u8 路径>
常用字用下面的 FIX 表手工覆盖（词典的第一义项不一定是小学生最先学的意思）。"""
import sys, io, re, json
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from phrases import load_data

D = load_data()
ced = {}
for line in open(sys.argv[1], encoding="utf-8"):
    if line.startswith("#"): continue
    m = re.match(r"(\S+) (\S+) \[([^\]]+)\] /(.+)/", line.rstrip())
    if not m: continue
    trad, simp, py, defs = m.groups()
    if len(simp) != 1: continue
    ced.setdefault(simp, []).append((py, defs.split("/")))

TONES = str.maketrans("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü", "aaaaeeeeiiiioooouuuuvvvvv")
REJECT = re.compile(r"variant of|surname|^see |old variant|^used in|Japanese|Kangxi|abbr|short name|ethnic|^name of|place name|phonetic|^particle", re.I)
def ok(d):
    d = re.sub(r"^\([^)]*\)\s*", "", d.strip())      # 去掉开头的 (bound form) / (literary) 之类标注
    return bool(d) and not REJECT.search(d) and not d[0].isupper()
def clean(d):
    d = re.sub(r"\([^)]*\)", "", d); d = re.sub(r"\[[^\]]*\]", "", d); d = re.sub(r"[一-鿿|]+", "", d)
    d = re.sub(r"\bCL:.*$", "", d); d = re.sub(r"\s+", " ", d).strip(" ;,:")
    parts = [p.strip() for p in d.split(";") if p.strip()]
    return "; ".join(parts[:2])
def pick(c, py):
    ents = ced.get(c, []); want = py.split("/")[0].lower().translate(TONES)
    ents = sorted(ents, key=lambda e: (0 if e[0] == e[0].lower() else 1, 0 if re.sub(r"\d", "", e[0].lower()) == want else 1))
    for strict in (True, False):
        for p, defs in ents:
            if strict and p != p.lower(): continue
            for d in defs:
                if not ok(d): continue
                cd = clean(d)
                if cd and len(cd) <= 30: return cd
    for p, defs in ents:          # 实在没有合适的，宁可留空也不要“variant of”这类半句
        for d in defs:
            if REJECT.search(d.strip()): continue
            cd = clean(d)
            if cd: return cd[:30]
    return ""

FIX = json.loads((ROOT / "tools" / "en_fix.json").read_text(encoding="utf-8"))
en = {r[0]: pick(r[0], r[1]) for r in D}
for k, v in FIX.items():
    if k in en: en[k] = v
empty = [c for c, v in en.items() if not v]
print("无释义", len(empty), "".join(empty[:80]))
print([(r[0], en[r[0]]) for r in D[24:40]])
print([(r[0], en[r[0]]) for r in D[3000:3010]])
(ROOT / "tools" / "en_gloss.json").write_text(json.dumps(en, ensure_ascii=False, indent=0), encoding="utf-8")
print("已保存 tools/en_gloss.json")
