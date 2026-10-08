# -*- coding: utf-8 -*-
"""重新给 Whisper 听写结果打分：按“读音”比对而不是按字比对。

Whisper 听单字会写成同音字（力 -> 立），按字比就全错了；所以把应读文本和听到的文本都转成不带声调的拼音，
再算相似度。另外识别 Whisper 的幻觉句（“以下是普通话朗读”“订阅”之类）和空结果。

用法：python tools/rescore.py tools/_qa_adult.json [--threshold 0.6] [--print-bad]
"""
import sys, io, re, json, argparse, difflib
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from pypinyin import lazy_pinyin
from phrases import all_phrases, load_pinyin

ap = argparse.ArgumentParser()
ap.add_argument("report")
ap.add_argument("--threshold", type=float, default=0.6)
ap.add_argument("--print-bad", action="store_true")
args = ap.parse_args()

HALLU = re.compile(r"普通话|朗读|订阅|点赞|观看|字幕|谢谢大家|听不懂|请点")
PY_ITEMS = load_pinyin()["items"]
phr = dict(all_phrases())

def expected_text(key):
    """应读的汉字文本：汉字条目 = 字 + 诗句；拼音条目 = 读音字 + 儿歌（字母换成读音字）"""
    t = phr[key]
    t = re.sub(r"<\|phoneme_start\|>[^<]*<\|phoneme_end\|>", key if key in PY_ITEMS or len(key) == 1 and not key.isascii() else "", t)
    if key in PY_ITEMS:   # 拼音：标签已替换为 key，再把 key 换成读音字
        say = re.sub(r"<[^>]*>", "", PY_ITEMS[key]["say"])
        t = t.replace(key, say)
    return t

def py(s):
    s = re.sub(r"[^一-鿿]", "", s)
    return lazy_pinyin(s)

def score(expect, heard):
    a, b = py(expect), py(heard)
    if not a: return 1.0
    if not b: return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()

rep = json.loads(Path(args.report).read_text(encoding="utf-8"))
out = []
for r in rep:
    k = r["key"]
    if k not in phr: continue
    exp = expected_text(k)
    heard = r["heard"]
    s = score(exp, heard)
    flag = s < args.threshold or HALLU.search(heard) is not None or not py(heard)
    out.append({"key": k, "expect": exp, "heard": heard, "score": round(s, 2), "flag": flag})
bad = [r for r in out if r["flag"]]
if args.print_bad:
    print("".join(r["key"] for r in bad if not r["key"].startswith("ui_")))
    sys.exit()
print(f"共 {len(out)} 条，可疑 {len(bad)} 条（读音相似度 < {args.threshold} 或幻觉 / 空）")
for r in sorted(bad, key=lambda r: r["score"])[:60]:
    print(f'  {r["key"]} | 应「{r["expect"]}」 听「{r["heard"]}」 {r["score"]}')
Path(args.report).with_suffix(".rescored.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
