# -*- coding: utf-8 -*-
"""用本地 Whisper 把每条语音听写出来，按“读音”和应读文本比对，找出漏读 / 乱读 / 空白的条目。

要点（都是踩过坑的）：
- 两头各补 1 秒静音再送给 Whisper，否则 2 秒以内的短句经常被吞掉；
- 不给 initial_prompt，否则提示词会被当成幻觉吐出来（“以下是普通话朗读”）；
- 用不带声调的拼音比对，而不是比汉字：Whisper 听单字会写同音字（力 -> 立），还会写繁体。

用法：python tools/qa_audio.py [--dir audio] [--out tools/_qa_adult.json] [--only 一二三] [--threshold 0.6]
      python tools/qa_audio.py --out tools/_qa_adult.json --print-bad   # 只打印可疑的 key，喂给 gen_audio.py --redo
"""
import sys, io, re, json, argparse, difflib, time, subprocess
from pathlib import Path
import numpy as np
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

ap = argparse.ArgumentParser()
ap.add_argument("--dir", default="audio")
ap.add_argument("--out", default="tools/_qa_report.json")
ap.add_argument("--only", default="")
ap.add_argument("--threshold", type=float, default=0.6)
ap.add_argument("--print-bad", action="store_true")
ap.add_argument("--model", default="small")
args = ap.parse_args()
OUT = ROOT / args.out

def flagged(rep, thr):
    return [r for r in rep if r["flag"] if not r["key"].startswith("ui_")]

if args.print_bad:
    rep = json.loads(OUT.read_text(encoding="utf-8"))
    print("".join(r["key"] for r in flagged(rep, args.threshold)))
    sys.exit()

from phrases import all_phrases, load_pinyin
from pypinyin import lazy_pinyin
from faster_whisper import WhisperModel

PY_ITEMS = load_pinyin()["items"]
HALLU = re.compile(r"普通话|朗读|订阅|点赞|观看|字幕|谢谢大家|听不懂|请点|频道")
phr = dict(all_phrases())

def expected_text(key):
    t = phr[key]
    t = re.sub(r"<\|phoneme_start\|>[^<]*<\|phoneme_end\|>", key, t)        # 标签位置就是那个字 / 音
    if key in PY_ITEMS:
        say = re.sub(r"<[^>]*>", "", PY_ITEMS[key]["say"])
        t = t.replace(key, say)
    return t
def py(s): return lazy_pinyin(re.sub(r"[^一-鿿]", "", s))
def score(expect, heard):
    a, b = py(expect), py(heard)
    if not a: return 1.0
    if not b: return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()
def load_padded(f, pad=1.0):
    r = subprocess.run(["ffmpeg", "-v", "quiet", "-i", str(f), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True)
    a = np.frombuffer(r.stdout, dtype=np.float32); z = np.zeros(int(16000 * pad), dtype=np.float32)
    return np.concatenate([z, a, z]), len(a) / 16000

keys = [k for k in phr if (not args.only or k in args.only)]
keys = [k for k in keys if (ROOT / args.dir / f"{k}.mp3").exists()]
done = {}
if OUT.exists() and not args.only:
    try: done = {r["key"]: r for r in json.loads(OUT.read_text(encoding="utf-8")) if "flag" in r}
    except Exception: done = {}
model = WhisperModel(args.model, device="cpu", compute_type="int8")
res = list(done.values()); t0 = time.time(); n = 0
for k in keys:
    if k in done: continue
    audio, dur = load_padded(ROOT / args.dir / f"{k}.mp3")
    segs, _ = model.transcribe(audio, language="zh", beam_size=5, temperature=0, condition_on_previous_text=False, vad_filter=False)
    heard = "".join(s.text for s in segs).strip()
    exp = expected_text(k)
    s = score(exp, heard)
    nchar = len(re.sub(r"[^一-鿿]", "", exp))
    too_long = dur > max(4, (nchar * 0.35 + 1.2) * 2)       # 比正常语速慢两倍以上：多半是乱读
    too_short = dur < 0.5 + 0.15 * nchar
    flag = s < args.threshold or not py(heard) or HALLU.search(heard) is not None or too_long or too_short
    res.append({"key": k, "expect": exp, "heard": heard, "score": round(s, 2), "dur": round(dur, 2), "flag": flag})
    n += 1
    if n % 100 == 0:
        OUT.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
        print(f"{n}/{len(keys)-len(done)}  {(time.time()-t0)/60:.1f} 分钟", flush=True)
OUT.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
bad = flagged(res, args.threshold)
print(f"共 {len(res)} 条，可疑 {len(bad)} 条")
for r in sorted(bad, key=lambda r: r["score"])[:40]:
    print(f'  {r["key"]}  应「{r["expect"]}」 听「{r["heard"]}」 {r["score"]} {r["dur"]}s')
