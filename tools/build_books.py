# -*- coding: utf-8 -*-
r"""绘本目录 data/books.json：每本书的每一页（文字、三种语言旁白和配图是否存在），以及「字 / 拼音 → 哪本书哪一页」的索引。
页面文件本身（配图 webp、旁白 mp3）由 tools/build_media.py 放到托管地址 MEDIA/book/<主题>/<页>.*。

对应规则：
 - 拼音书：页的 slug 形如 03_ai_know / 04_ai_use，取中间那段当拼音项（ve→üe、v→ü、vn→ün）。
 - 诗句页（kind=poem / poem_full）：字表里 line 等于这句诗的字都挂上。
 - 词语页（kind=word）：word[0] 里在字表的字挂上。
 - 其他页：slug 中间那段是拼音时，页文字里读这个音的字挂上（优先封面书名里的字）。
用法：python -X utf8 tools/build_books.py"""
import re, json, unicodedata
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
BOOKS = Path(r'D:\美人鱼课')
html = (ROOT / 'index.html').read_text(encoding='utf-8')
DATA = json.loads(re.search(r'^const DATA=(\[\[.*?\]\]);', html, re.M).group(1))
PY = json.loads((ROOT / 'tools' / 'pinyin.json').read_text(encoding='utf-8'))['items']
LIB = json.loads((ROOT / 'data' / 'library.json').read_text(encoding='utf-8'))['items']

def strip_tone(py):
    py = py.split('/')[0].split(',')[0].strip()
    s = unicodedata.normalize('NFD', py)
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    return s.replace('ü', 'v').lower()
def norm_line(t): return re.sub(r'[\s，。！？、；：,.!?“”"「」『』—…·]', '', t)
BY = {}; LINE = {}
for r in DATA:
    c, py, line = r[0], r[1], r[5]
    BY.setdefault(c, []).append(r)
    LINE.setdefault(norm_line(line), []).append(c)
PYKEY = {k.replace('ü', 'v'): k for k in PY}      # ve -> üe
def libidx(theme):
    key = re.sub(r'[_\W]', '', theme).replace('诗词版', '')
    for i in LIB:
        if re.sub(r'[_\W]', '', i['theme']).replace('诗词版', '') == key: return i['n']
    return None

books, idx = [], {}
def add(key, b, n):
    lst = idx.setdefault(key, [])
    if [b, n] not in lst: lst.append([b, n])
unmatched = []
for book in sorted(BOOKS.glob('绘本_*')):
    cp = book / 'content.py'
    if not book.is_dir() or not cp.exists(): continue
    ns = {}; exec(compile(cp.read_text(encoding='utf-8'), str(cp), 'exec'), ns)
    pages = ns.get('PAGES')
    if not pages: continue
    theme = book.name[len('绘本_'):]
    cover = next((p for p in pages if p.get('kind') == 'cover'), pages[0])
    title = cover['zh'].split('\n')[0]; title_chars = [c for c in title if c in BY]
    bi = len(books)
    B = {'t': theme, 'title': title, 'sub': cover.get('sub', ''), 'lib': libidx(theme), 'pages': []}
    books.append(B)
    is_py = theme.startswith('拼音')
    for pg in pages:
        n = int(pg['n']); slug = pg['slug']; kind = pg.get('kind', 'plain')
        imgs = [i for i in book.glob(f'assets/{slug}.*') if i.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')]
        au = ''.join(l for l in ('zh', 'en', 'da') if (book / 'audio' / l / f'p{n:02d}.mp3').exists())
        P = {'n': n, 'k': kind, 'zh': pg['zh'], 'en': pg.get('en', ''), 'da': pg.get('da', ''), 'img': 1 if imgs else 0, 'au': au}
        if pg.get('word'): P['w'] = pg['word'][0]
        B['pages'].append(P)
        m = re.match(r'^\d+_([a-z]+)(?:_|$)', slug); tok = m.group(1) if m else None
        if is_py:
            parts = slug.split('_')[1:]
            if theme == '拼音_单韵母' and 'yu' in parts: parts = ['v' if x == 'yu' else x for x in parts]   # 单韵母书里的 yu 页讲的是 ü
            hits = [PYKEY[x] for x in parts if x in PYKEY]
            if hits:
                for k in hits: add(k, bi, n)
                continue
        if kind in ('poem', 'poem_full'):
            for sent in re.split(r'[。！？\n]', pg['zh']):
                for c in LINE.get(norm_line(sent), []): add(c, bi, n)
            if kind == 'poem_full':
                for c in LINE.get(norm_line(pg['zh']), []): add(c, bi, n)
            continue
        if kind == 'word' and pg.get('word'):
            for c in pg['word'][0]:
                if c in BY: add(c, bi, n)
            continue
        if tok and not is_py:
            cands = [c for c in dict.fromkeys(title_chars + list(pg['zh'])) if c in BY and any(strip_tone(r[1]) == tok for r in BY[c])]
            if cands: add(cands[0], bi, n)
            elif tok not in ('cover', 'opening', 'ending', 'secret', 'full', 'goodnight', 'review', 'game', 'song'): unmatched.append((theme, slug))
out = {'books': books, 'idx': idx}
(ROOT / 'data' / 'books.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
npg = sum(len(b['pages']) for b in books)
print(f"{len(books)} 本，{npg} 页，索引 {len(idx)} 个字/拼音项，有视频链接的书 {sum(1 for b in books if b['lib'] is not None)} 本，books.json {round((ROOT/'data'/'books.json').stat().st_size/1e3)} KB")
print('没对上的 slug', len(unmatched), unmatched[:25])
print('拼音项覆盖', sum(1 for k in PY if k in idx), '/', len(PY), '缺', [k for k in PY if k not in idx])
