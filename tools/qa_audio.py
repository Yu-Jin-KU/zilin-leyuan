# -*- coding: utf-8 -*-
"""用本地 Whisper 把每条语音转成文字，和应读的文字比对，找出漏读 / 乱读的条目。

用法：python tools/qa_audio.py [--dir audio] [--out tools/_qa_report.json] [--only 一二三]
结果：JSON 列表 [{key, expect, heard, score}]，score 越低越可疑；低于 0.45 的建议重做：
      python tools/gen_audio.py --redo "$(python tools/qa_audio.py --print-bad)"
"""
import sys, io, re, json, argparse, difflib, time
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

ap = argparse.ArgumentParser()
ap.add_argument("--dir", default="audio")
ap.add_argument("--out", default="tools/_qa_report.json")
ap.add_argument("--only", default="")
ap.add_argument("--threshold", type=float, default=0.45)
ap.add_argument("--print-bad", action="store_true")
args = ap.parse_args()
OUT = ROOT / args.out

if args.print_bad:
    rep = json.loads(OUT.read_text(encoding="utf-8"))
    print("".join(r["key"] for r in rep if r["score"] < args.threshold and not r["key"].startswith("ui_")))
    sys.exit()

from phrases import all_phrases   # 共用 gen_audio 的字表解析
from faster_whisper import WhisperModel

PUNCT = re.compile(r"[，。！？、,.!?\s<>|a-z0-9_]+")
def norm(s): return PUNCT.sub("", re.sub(r"<\|phoneme_start\|>[^<]*<\|phoneme_end\|>", "", s))

phr = dict(all_phrases())
keys = [k for k in phr if (not args.only or k in args.only)]
keys = [k for k in keys if (ROOT / args.dir / f"{k}.mp3").exists()]
done = {}
if OUT.exists() and not args.only:
    done = {r["key"]: r for r in json.loads(OUT.read_text(encoding="utf-8"))}
model = WhisperModel("small", device="cpu", compute_type="int8")
res = list(done.values()); t0 = time.time(); n = 0
for k in keys:
    if k in done: continue
    f = ROOT / args.dir / f"{k}.mp3"
    segs, _ = model.transcribe(str(f), language="zh", beam_size=3, initial_prompt="以下是普通话朗读。")
    heard = norm("".join(s.text for s in segs))
    exp = norm(phr[k])
    # 字母条目的期望文本是“啊，张大嘴巴，啊啊啊”，比对时只看儿歌部分
    score = difflib.SequenceMatcher(None, exp, heard).ratio()
    res.append({"key": k, "expect": exp, "heard": heard, "score": round(score, 2)})
    n += 1
    if n % 100 == 0:
        OUT.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
        print(f"{n}/{len(keys)-len(done)}  {(time.time()-t0)/60:.1f} 分钟", flush=True)
OUT.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
bad = [r for r in res if r["score"] < args.threshold]
print(f"共 {len(res)} 条，可疑 {len(bad)} 条（相似度 < {args.threshold}）")
for r in sorted(bad, key=lambda r: r["score"])[:40]:
    print(f"  {r['key']}  应读「{r['expect']}」 听到「{r['heard']}」 {r['score']}")
