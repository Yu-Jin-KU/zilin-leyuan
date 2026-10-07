# -*- coding: utf-8 -*-
"""字灵乐园 · 批量生成语音（Fish Audio，免费模型 s2.1-pro-free）

用法：
    set FISH_API_KEY=你的密钥        (PowerShell: $env:FISH_API_KEY="...")
    python tools/gen_audio.py            # 生成缺的音频；已存在的跳过
    python tools/gen_audio.py --voice <reference_id>   # 换一个声音（删掉 audio/ 后重跑）

输出：audio/<字>.mp3（32 kbps 单声道，适合网页）；原始 64 kbps 文件留在 --raw 目录。
需要 ffmpeg 在 PATH 里；没有的话会直接保存 64 kbps 原文件。
"""
import os, sys, io, json, re, time, argparse, shutil, subprocess, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("--voice", default="faccba1a8ac54016bcfc02761285e67f")  # 温柔动听女声
ap.add_argument("--model", default="s2.1-pro-free")
ap.add_argument("--speed", type=float, default=0.88)
ap.add_argument("--threads", type=int, default=4)   # 免费档并发上限 5
ap.add_argument("--raw", default=str(ROOT / "tools" / "_raw_audio"))
ap.add_argument("--out", default=str(ROOT / "audio"))
ap.add_argument("--only", default="")   # 调试：只生成这些字，如 "一二三"
args = ap.parse_args()

from fishaudio import FishAudio
from fishaudio.types import TTSConfig

API_KEY = os.environ.get("FISH_API_KEY")
if not API_KEY:
    sys.exit("请先设置环境变量 FISH_API_KEY")
client = FishAudio(api_key=API_KEY)
RAW, OUT = Path(args.raw), Path(args.out)
RAW.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
HAS_FFMPEG = shutil.which("ffmpeg") is not None

# ---------- 从 index.html 读出字表 ----------
html = (ROOT / "index.html").read_text(encoding="utf-8")
DATA = json.loads(re.search(r"^const DATA=(\[\[.*?\]\]);", html, re.M).group(1))
def js_obj(name):
    src = re.search(name + r"=(\{.*?\});", html, re.S).group(1)
    return dict(re.findall(r"'?([a-zü])'?:'([^']*)'", src))
LETTER_SAY = js_obj("const LETTER_SAY"); LETTER_LINES = js_obj("LETTER_LINES")
LETTERS = "a o e i u ü b p m f d t n l g k h j q x z c s r y w".split()

# ---------- 拼音：带调字母 -> 数字调（给 Fish 的注音标签用，保证单字读音正确） ----------
TONES = {"ā":"a1","á":"a2","ǎ":"a3","à":"a4","ē":"e1","é":"e2","ě":"e3","è":"e4","ī":"i1","í":"i2","ǐ":"i3","ì":"i4",
         "ō":"o1","ó":"o2","ǒ":"o3","ò":"o4","ū":"u1","ú":"u2","ǔ":"u3","ù":"u4","ǖ":"v1","ǘ":"v2","ǚ":"v3","ǜ":"v4","ü":"v","ń":"n2","ň":"n3","ǹ":"n4","ḿ":"m2"}
def numbered(py):
    py = py.split("/")[0].split(",")[0].split(" ")[0].strip()
    tone = ""; out = ""
    for ch in py:
        if ch in TONES:
            v = TONES[ch]; out += v[0]
            if len(v) > 1: tone = v[1]
        elif ch.isalpha(): out += ch
        else: return None
    if not out: return None
    return out + (tone or "5")

def phrase_for_char(row):
    c, py, line = row[0], row[1], row[5]
    n = numbered(py)
    tag = f"<|phoneme_start|>{n}<|phoneme_end|>" if n else ""
    return f"{c}{tag}。{line}"

def phrase_for_letter(c):
    sound = LETTER_SAY[c]
    line = LETTER_LINES[c]
    line = re.sub(r"[a-zü]+", sound, line)          # “张大嘴巴 a a a” -> “张大嘴巴 啊 啊 啊”
    return f"{sound}，{line}"

UI = {
    "ui_intro": "先看一遍笔顺，再自己写！",
    "ui_watch": "看好每一笔的方向哦。",
    "ui_start": "一笔一笔写，写对会变颜色。",
    "ui_hint": "看，闪光的地方就是下一笔。",
    "ui_retry": "再试一次，注意从哪里开始写。",
    "ui_good1": "真棒！", "ui_good2": "对啦！", "ui_good3": "好样的！", "ui_good4": "继续！",
    "ui_summon": "召唤成功！", "ui_evolve": "进化啦！", "ui_again3": "又是三颗星！字灵大王为你骄傲。",
    "ui_keep": "你的最好成绩不会变少，再试一次吧。",
    "ui_star1": "一颗星。", "ui_star2": "两颗星。", "ui_star3": "三颗星！",
    "ui_who": "谁来写字？点自己的名字。",
    "ui_welcome": "欢迎来到字灵乐园！写对一个字，就能召唤一只字灵。",
}

jobs = []
for c in LETTERS: jobs.append((c, phrase_for_letter(c)))
for r in DATA: jobs.append((r[0], phrase_for_char(r)))
for k, t in UI.items(): jobs.append((k, t))
if args.only:
    jobs = [j for j in jobs if j[0] in args.only or j[0].startswith("ui_")]

def final_path(key): return OUT / f"{key}.mp3"
todo = [j for j in jobs if not final_path(j[0]).exists()]
print(f"共 {len(jobs)} 条，已完成 {len(jobs)-len(todo)}，待生成 {len(todo)}。声音 {args.voice}，模型 {args.model}")

lock = threading.Lock(); done = 0; fails = []
def work(key, text):
    raw = RAW / f"{key}.mp3"
    if not raw.exists():
        for attempt in range(6):
            try:
                audio = client.tts.convert(text=text, model=args.model, reference_id=args.voice,
                    config=TTSConfig(format="mp3", mp3_bitrate=64, prosody={"speed": args.speed}))
                if len(audio) < 2000: raise RuntimeError(f"音频太短 {len(audio)}B")
                raw.write_bytes(audio); break
            except Exception as e:
                wait = min(60, 3 * 2 ** attempt)
                with lock: print(f"  [{key}] 第{attempt+1}次失败: {str(e)[:120]}，{wait}s 后重试")
                time.sleep(wait)
        else:
            raise RuntimeError("放弃")
    if HAS_FFMPEG:
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-ac", "1", "-ar", "24000",
                            "-b:a", "32k", "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15",
                            str(final_path(key)) + ".tmp.mp3"], capture_output=True, text=True)
        if r.returncode != 0: raise RuntimeError("ffmpeg: " + r.stderr[:200])
        os.replace(str(final_path(key)) + ".tmp.mp3", final_path(key))
    else:
        shutil.copyfile(raw, final_path(key))

t0 = time.time()
with ThreadPoolExecutor(max_workers=args.threads) as ex:
    futs = {ex.submit(work, k, t): k for k, t in todo}
    for f in as_completed(futs):
        k = futs[f]
        try:
            f.result(); done += 1
        except Exception as e:
            fails.append(k); print(f"  [{k}] 失败: {e}")
        if done % 50 == 0 and done:
            el = time.time() - t0
            print(f"{done}/{len(todo)}  {el/60:.1f} 分钟，预计还需 {el/done*(len(todo)-done)/60:.0f} 分钟", flush=True)

print(f"完成 {done}，失败 {len(fails)}：{''.join(fails)[:200]}")
total = sum(p.stat().st_size for p in OUT.glob("*.mp3"))
print(f"audio/ 共 {len(list(OUT.glob('*.mp3')))} 个文件，{total/1e6:.1f} MB")
