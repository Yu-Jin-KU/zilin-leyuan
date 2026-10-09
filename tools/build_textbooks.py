# -*- coding: utf-8 -*-
"""tools/textbooks/zwNN.lessons.json（由 parse_book.py 从 hwjyw.com 的《中文》PDF 识别得到）+ overrides.json
-> data/textbooks.json，给老师版按教材课次选生字用。
格式：{"中文":{"1":{"lessons":{"1":[字...],...},"extra":[本册没能归到课的字]}, ...}}"""
import json, re, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
src = ROOT / "tools" / "textbooks"
ov = json.loads((src / "overrides.json").read_text(encoding="utf-8"))
html = (ROOT / "index.html").read_text(encoding="utf-8")
LIB = set(r[0] for r in json.loads(re.search(r"^const DATA=(\[\[.*?\]\]);", html, re.M).group(1)))   # 字库里有的字
out = {"中文": {}}
for f in sorted(src.glob("zw*.lessons.json")):
    stem = f.stem.split(".")[0]; vol = str(int(stem[2:]))
    r = json.loads(f.read_text(encoding="utf-8"))
    lessons = {k: list(v) for k, v in r["lessons"].items()}
    extra = list(r.get("unassigned", ""))
    for k, o in ov.get(stem, {}).items():
        if k.startswith("_"): continue
        lessons.setdefault(k, [])
        for ch in o.get("drop", ""):
            if ch in lessons[k]: lessons[k].remove(ch)
        for ch in o.get("add", ""):
            if ch not in lessons[k]: lessons[k].append(ch)
            if ch in extra: extra.remove(ch)
    lessons = {k: [c for c in v if c in LIB] for k, v in lessons.items()}   # 去掉繁体和 OCR 认出的怪字
    extra = [c for c in extra if c in LIB]
    out["中文"][vol] = {"lessons": dict(sorted(lessons.items(), key=lambda kv: int(kv[0]))), "extra": extra}
    print(f"《中文》第{vol}册：{len(lessons)} 课，{sum(len(v) for v in lessons.values())} 字，未归课 {len(extra)}")
(ROOT / "data" / "textbooks.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
