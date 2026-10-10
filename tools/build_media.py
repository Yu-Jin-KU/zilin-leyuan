# -*- coding: utf-8 -*-
r"""把要托管到 Cloudflare 的语音和图片整理到 _media/（不进 git），然后在 media/ 和 media2/ 里 npx wrangler deploy。

 _media/zilin-media/   kid/<字>.mp3（童声 9116 条）+ book/<主题>/<页>.webp（绘本每页配图，1024 宽）
                       + book/<主题>/<页>.<zh|en|da>.mp3（每页旁白，不带配乐，48k 单声道 40 kbps）
 _media/zilin-media2/  adult/ 和 teacher/（隐藏的两套声音）
 每个 Worker 的静态文件数上限 2 万个，所以分成两个。
用法：python -X utf8 tools/build_media.py [--skip-audio] [--skip-books]
已有的文件会跳过（可以断点续跑）。"""
import os, sys, re, glob, subprocess, shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT = Path(__file__).resolve().parent.parent
OUT1 = ROOT / '_media' / 'zilin-media'; OUT2 = ROOT / '_media' / 'zilin-media2'
BOOKS = Path(r'D:\美人鱼课')
HEADERS = "/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=31536000, immutable\n"

def link_or_copy(src, dst):
    if dst.exists(): return
    dst.parent.mkdir(parents=True, exist_ok=True)
    try: os.link(src, dst)
    except OSError: shutil.copy2(src, dst)

def stage_audio():
    for sub, out in (('kid', OUT1 / 'kid'), ('', OUT2 / 'adult'), ('teacher', OUT2 / 'teacher')):
        src = ROOT / 'audio' / sub
        n = 0
        for f in src.glob('*.mp3'):
            link_or_copy(f, out / f.name); n += 1
        print(sub or 'adult', n)

def load_pages(book):
    cp = book / 'content.py'
    if not cp.exists(): return None
    ns = {}
    exec(compile(cp.read_text(encoding='utf-8'), str(cp), 'exec'), ns)
    return ns.get('PAGES')

def page_image(book, pg):
    """页面配图：自己的 slug 图；没有就用 img 字段指的图（比如 cover）；再没有就用 refs 里引用的那页的图。"""
    cands = [pg['slug']] + ([pg['img']] if isinstance(pg.get('img'), str) else []) + [r for r in (pg.get('refs') or []) if isinstance(r, str)]
    for c in cands:
        for f in sorted(book.glob(f'assets/{c}.*')):
            if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp') and not f.name.startswith('_'): return f
    return None

def do_image(src, dst):
    if dst.exists(): return
    from PIL import Image
    im = Image.open(src).convert('RGB'); im.thumbnail((1024, 1024)); dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, 'WEBP', quality=80, method=4)

def do_clip(src, dst):
    if dst.exists(): return
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-i', str(src), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ac', '1', '-ar', '32000', '-b:a', '40k', str(dst)], check=True)

def stage_books():
    jobs = []
    for book in sorted(BOOKS.glob('绘本_*')):
        if not book.is_dir(): continue
        pages = load_pages(book)
        if not pages: continue
        theme = book.name[len('绘本_'):]
        out = OUT1 / 'book' / theme
        for pg in pages:
            n = int(pg['n'])
            src = page_image(book, pg)
            if src: jobs.append(('img', src, out / f'{n}.webp'))
            for lang in ('zh', 'en', 'da'):
                clip = book / 'audio' / lang / f'p{n:02d}.mp3'
                if clip.exists(): jobs.append(('clip', clip, out / f'{n}.{lang}.mp3'))
    print('book jobs', len(jobs))
    done = [0]
    def run(j):
        kind, s, d = j
        try: (do_image if kind == 'img' else do_clip)(s, d)
        except Exception as e: print('FAIL', s, e)
        done[0] += 1
        if done[0] % 500 == 0: print(done[0], flush=True)
    with ThreadPoolExecutor(4) as ex: list(ex.map(run, jobs))

if __name__ == '__main__':
    for out in (OUT1, OUT2):
        out.mkdir(parents=True, exist_ok=True); (out / '_headers').write_text(HEADERS, encoding='utf-8')
    if '--skip-audio' not in sys.argv: stage_audio()
    if '--skip-books' not in sys.argv: stage_books()
    for out in (OUT1, OUT2):
        n = sum(1 for _ in out.rglob('*') if _.is_file()); print(out.name, n, 'files', round(sum(f.stat().st_size for f in out.rglob('*') if f.is_file()) / 1e6), 'MB')
