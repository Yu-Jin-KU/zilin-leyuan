# -*- coding: utf-8 -*-
"""tools/meaning.tsv -> data/meaning.json，并把 tsv 里的表情合并进 index.html 的 EMOJI。
用法：python tools/build_meaning.py   （改完 tsv 以后跑一次；新字的语音再跑 gen_audio.py 两种声音）"""
import re, json, sys, io
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
rows = []
for ln in (ROOT / "tools" / "meaning.tsv").read_text(encoding="utf-8").splitlines():
    if not ln.strip() or ln.startswith("#"): continue
    c, m, w, e = (ln.rstrip("\n").split("\t") + ["", "", ""])[:4]
    assert len(w.split()) == 2 and m[-1] in "。？！", (c, m, w)
    rows.append((c, m, w.split(), e))
assert len({r[0] for r in rows}) == len(rows), "有重复的字"
(ROOT / "data" / "meaning.json").write_text(json.dumps({c: [m, w] for c, m, w, e in rows}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
p = ROOT / "index.html"; s = p.read_text(encoding="utf-8")
mm = re.search(r"const EMOJI=(\{.*?\});", s); em = eval(mm.group(1)); added = 0
for c, m, w, e in rows:
    if e and c not in em: em[c] = e; added += 1
s = s[:mm.start()] + "const EMOJI={" + ",".join(f"'{k}':'{v}'" for k, v in em.items()) + "};" + s[mm.end():]
p.write_text(s, encoding="utf-8")
print(f"{len(rows)} 个字 -> data/meaning.json；EMOJI 新增 {added}，共 {len(em)}")
