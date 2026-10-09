# -*- coding: utf-8 -*-
"""字灵乐园 · 批量生成语音（Fish Audio，免费模型 s2.1-pro-free）

用法：
    $env:FISH_API_KEY="你的密钥"          (bash: export FISH_API_KEY=...)
    python tools/gen_audio.py                         # 成人女声，生成缺的文件到 audio/
    python tools/gen_audio.py --voice kid             # 童声，生成到 audio/kid/
    python tools/gen_audio.py --voice <reference_id> --out audio/xxx   # 任意 Fish 公共音色
    python tools/gen_audio.py --redo "一二三"          # 强制重做这几个字
    python tools/gen_audio.py --only  "一二三"          # 只生成这几个字（调试）

朗读文本来自 tools/phrases.py（字表 + tools/pinyin.json + 提示语）。
输出 32 kbps 单声道 mp3；原始 64 kbps 文件留在 tools/_raw_audio/<声音>/。需要 ffmpeg。
"""
import os, sys, io, time, argparse, shutil, subprocess, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from phrases import all_phrases

VOICES = {   # 名字 -> (reference_id, 默认输出目录, 语速)
    "adult": ("faccba1a8ac54016bcfc02761285e67f", "audio", 0.88),       # 温柔动听女声
    "kid":   ("27bbdacb95f6449a806dd4a9ac85aba9", "audio/kid", 0.92),   # 小悠克隆（用美人鱼课绘本旁白训练的私有模型）
    "kid2":  ("8ab237c79d36417e84030674b8ab4cfd", "audio/kid2", 0.92),  # Fish 公共音色 童声·讲故事（备选）
    "teacher": ("50e0df039a7c4c34987064ddc40152fe", "audio/teacher", 0.9),  # 金玉老师本人的克隆（2026-10-10 用 tools/_我的声音 的录音训练，私有）
}

ap = argparse.ArgumentParser()
ap.add_argument("--voice", default="adult", help="adult / kid / 任意 reference_id")
ap.add_argument("--model", default="s2.1-pro-free")
ap.add_argument("--speed", type=float, default=None)
ap.add_argument("--threads", type=int, default=4)   # 免费档并发上限 5
ap.add_argument("--out", default=None)
ap.add_argument("--only", default="")
ap.add_argument("--redo", default="")
args = ap.parse_args()

if args.voice in VOICES:
    REF, out_default, speed_default = VOICES[args.voice]
else:
    REF, out_default, speed_default = args.voice, f"audio/{args.voice[:8]}", 0.9
OUT = ROOT / (args.out or out_default)
RAW = ROOT / "tools" / "_raw_audio" / REF[:8]
SPEED = args.speed if args.speed is not None else speed_default

from fishaudio import FishAudio
from fishaudio.types import TTSConfig
API_KEY = os.environ.get("FISH_API_KEY")
if not API_KEY:
    sys.exit("请先设置环境变量 FISH_API_KEY")
client = FishAudio(api_key=API_KEY)
RAW.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
if shutil.which("ffmpeg") is None:
    sys.exit("需要 ffmpeg（用于压成 32 kbps 单声道）")

jobs = all_phrases()
if args.only:
    jobs = [j for j in jobs if j[0] in args.only]
if args.redo:
    for k in args.redo:
        for p in (OUT / f"{k}.mp3", RAW / f"{k}.mp3"):
            if p.exists(): p.unlink()
    jobs = [j for j in jobs if j[0] in args.redo] if not args.only else jobs

def final_path(key): return OUT / f"{key}.mp3"
todo = [j for j in jobs if not final_path(j[0]).exists()]
print(f"共 {len(jobs)} 条，已完成 {len(jobs)-len(todo)}，待生成 {len(todo)}。声音 {REF}，模型 {args.model}，输出 {OUT.relative_to(ROOT)}")

lock = threading.Lock(); done = 0; fails = []
def work(key, text):
    raw = RAW / f"{key}.mp3"
    if not raw.exists():
        for attempt in range(6):
            try:
                audio = client.tts.convert(text=text, model=args.model, reference_id=REF,
                    config=TTSConfig(format="mp3", mp3_bitrate=64, prosody={"speed": SPEED}))
                if len(audio) < 2000: raise RuntimeError(f"音频太短 {len(audio)}B")
                raw.write_bytes(audio); break
            except Exception as e:
                wait = min(60, 3 * 2 ** attempt)
                with lock: print(f"  [{key}] 第{attempt+1}次失败: {str(e)[:120]}，{wait}s 后重试")
                time.sleep(wait)
        else:
            raise RuntimeError("放弃")
    tmp = str(final_path(key)) + ".tmp.mp3"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-ac", "1", "-ar", "24000", "-b:a", "32k",
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15",
                        tmp], capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError("ffmpeg: " + r.stderr[:200])
    os.replace(tmp, final_path(key))

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
print(f"{OUT.relative_to(ROOT)}/ 共 {len(list(OUT.glob('*.mp3')))} 个文件，{total/1e6:.1f} MB")
