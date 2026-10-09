# -*- coding: utf-8 -*-
"""从 index.html 的 DATA / GRADE_META 和 tools/pinyin.json 生成 data/grades.json（老师页选字用）。"""
import re, json, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
s = (ROOT / "index.html").read_text(encoding="utf-8")
import ast
meta = ast.literal_eval(re.search(r"^const GRADE_META=(\[.*?\]);", s, re.M).group(1))
data = json.loads(re.search(r"^const DATA=(\[\[.*?\]\]);", s, re.M).group(1))
py = json.loads((ROOT / "tools" / "pinyin.json").read_text(encoding="utf-8"))
grades = [{"id": i, "name": m[0], "sub": m[1], "chars": []} for i, m in enumerate(meta)]
for g in py["groups"]: grades[0]["chars"] += g["items"]
for r in data: grades[r[8]]["chars"].append(r[0])
(ROOT / "data" / "grades.json").write_text(json.dumps(grades, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("grades.json:", [(g["name"], len(g["chars"])) for g in grades][:4], "...")
