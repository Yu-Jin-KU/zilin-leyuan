# -*- coding: utf-8 -*-
"""Parse <stem>.ocr.json of a 《中文》 textbook into per-lesson 生字 lists.
usage: python parse_book.py zw01 [zw02 ...]   -> <stem>.lessons.json + readable report
  * lesson start pages: a big digit (h>=45) top-left
  * book new-character set: the 音序生字表 pages near the back
  * per lesson: the 「生字 (Characters)」 box = rows of (pinyin line, big-character line).
    Tokens and characters are paired by order/column; a token without a character under it means OCR
    missed a simple character (一 二 三 …), which is recovered by exact pinyin among our own character
    table, preferring characters in the book's 生字表 and then fewer strokes."""
import sys, re, json
from pathlib import Path
ROOT = Path(r'C:\Users\玉\Documents\字灵乐园')
html = (ROOT / 'index.html').read_text(encoding='utf-8')
DATA = json.loads(re.search(r'^const DATA=(\[\[.*?\]\]);', html, re.M).group(1))
TONE = str.maketrans('āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ', 'aaaaeeeeiiiioooouuuuüüüü')
PY, STROKES = {}, {}
for r in DATA:
    STROKES[r[0]] = r[7]
    for p in re.split(r'[/,\s]+', r[1]):
        p = p.translate(TONE).strip()
        if p: PY.setdefault(r[0], set()).add(p)
BYPY = {}
for c, ps in PY.items():
    for p in ps: BYPY.setdefault(p, []).append(c)
CJK = re.compile(r'[\u4e00-\u9fff]')
HEAD = re.compile(r'(词语|句子|课堂|阅读|练习|Words|Sentence|Exercise|Read|综合|总练习|笔顺|Stroke)')
FIX = {'1': 'i', '0': 'o', '|': 'l', 'α': 'a', 'ɑ': 'a'}

def norm_py(t):
    t = t.lower().translate(TONE)
    t = ''.join(FIX.get(ch, ch) for ch in t)
    return re.sub(r'[^a-zü]', '', t)

def parse(stem):
    pages = json.loads(Path(stem + '.ocr.json').read_text(encoding='utf-8'))
    N = len(pages)
    starts = {}
    for i, p in enumerate(pages):
        for l in p:
            if l['h'] >= 45 and l['y'] < 260 and l['x'] < 220 and re.fullmatch(r'\d{1,2}', l['t'].strip()):
                n = int(l['t'])
                if 1 <= n <= 15 and n not in starts: starts[n] = i
    try:   # 手工指定课头页（OCR 没认出大数字时）：overrides.json 里 "zwNN": {"_starts": {"9": 84}}
        ov = json.loads((ROOT / 'tools' / 'textbooks' / 'overrides.json').read_text(encoding='utf-8')).get(Path(stem).name, {}).get('_starts', {})
        for k, v in ov.items(): starts[int(k)] = int(v)
    except Exception as e: print('override error', e)
    lessons = sorted(starts.items())
    # 本册的音序生字表是后面第一个「生字表」标题页，到「生词表」标题页为止（后面还会有前几册的累计表，不能要）
    heading = lambda p, word: any(word in l['t'].replace(' ', '') and l['h'] >= 25 for l in p)
    tbl = [i for i, p in enumerate(pages) if i > N // 2 and heading(p, '生字表')]
    tbl_pages = []
    if tbl:
        i = tbl[0]
        while i < N and len(tbl_pages) < 4 and not (i > tbl[0] and (heading(pages[i], '生词表') or heading(pages[i], '生字表'))):
            tbl_pages.append(i); i += 1
    book_set, pairs = [], {}
    for i in tbl_pages:
        for l in pages[i]:
            t = re.sub(r'[（(][^）)]*[）)]?', '', l['t'])
            if '生字表' in t or 'Vocabulary' in t or '简繁' in t: continue
            for m in re.finditer(r'([\u4e00-\u9fff])(\d{1,2})?', t):
                ch, num = m.group(1), m.group(2)
                if ch not in book_set: book_set.append(ch)
                if num and 1 <= int(num) <= 15 and ch not in pairs: pairs[ch] = int(num)
    book_set = [c for c in book_set if c not in '中文']
    bs = set(book_set)
    out, notes, assigned = {}, [], set()
    for k, (n, s) in enumerate(lessons):
        e = lessons[k + 1][1] - 1 if k + 1 < len(lessons) else (tbl_pages[0] - 1 if tbl_pages else N - 1)
        rows = []  # (kind, y, items) kind 'py' -> [(x_center, token)], 'ch' -> [(x_center, char)]
        for i in range(s, e + 1):
            p = sorted(pages[i], key=lambda l: (l['y'], l['x']))
            heads = [l for l in p if l['h'] >= 26 and re.match(r'^\s*生字\s*(\(|（|$)', l['t'])]
            if not heads: continue
            y0 = heads[0]['y']
            for l in p:
                if l['y'] <= y0 or l is heads[0]: continue
                if l['h'] >= 24 and HEAD.search(l['t']): break
                if l['h'] >= 28 and CJK.search(l['t']):
                    chars = [ch for ch in l['t'] if CJK.match(ch)]
                    if not chars: continue
                    step = l['w'] / max(1, len(l['t']))
                    items = []
                    for idx, ch in enumerate(l['t']):
                        if CJK.match(ch): items.append((l['x'] + step * (idx + .5), ch))
                    rows.append(('ch', l['y'], items))
                elif 13 <= l['h'] <= 27 and re.search(r'[a-zA-Zü]', l['t']) and not CJK.search(l['t']):
                    raw = l['t'].strip(); toks = []
                    pos = 0
                    for m in re.finditer(r'\S+', raw):
                        tok = norm_py(m.group(0))
                        if 1 <= len(tok) <= 7:
                            cx = l['x'] + l['w'] * ((m.start() + m.end()) / 2) / max(1, len(raw))
                            toks.append((cx, tok))
                    if toks: rows.append(('py', l['y'], toks))
        # merge adjacent lines of the same kind at (nearly) the same y
        merged = []
        for kind, y, items in sorted(rows, key=lambda r: r[1]):
            if merged and merged[-1][0] == kind and abs(merged[-1][1] - y) < 12:
                merged[-1][2].extend(items); merged[-1][2].sort()
            else: merged.append([kind, y, sorted(items)])
        got, pending_py = [], []
        for idx, (kind, y, items) in enumerate(merged):
            if kind == 'ch':
                for cx, ch in items:
                    if ch not in got and ch not in assigned: got.append(ch)
                continue
            # pinyin row: find the char row right below (within 90 px)
            below = next((r for r in merged[idx + 1:] if r[0] == 'ch' and 0 < r[1] - y < 90), None)
            chars = below[2] if below else []
            for cx, tok in items:
                near = [c for (x2, c) in chars if abs(x2 - cx) < 30]
                ok = any(tok in PY.get(c, ()) or any(_sim(tok, p) for p in PY.get(c, ())) for c in near)
                if not ok: pending_py.append(tok)
        SIMPLE = '一二三十' if stem.endswith('01') else ''   # 第一册里 OCR 常漏掉的极简字，允许不在生字表里也补回；后面的册不需要
        for tok in pending_py:
            if len(tok) < 2: continue
            variants = [tok, tok.replace('d', 'a'), tok.replace('o', 'a')]
            cands = []
            for v in variants:
                cands += [c for c in BYPY.get(v, []) if c not in assigned and c not in got and c not in cands]
                if cands: break
            if not cands: notes.append(f'第{n}课 拼音 {tok} 下面没认出字，也找不到对应字'); continue
            simple = [c for c in cands if c in SIMPLE]
            in_book = [c for c in cands if c in bs]
            if simple:
                got.append(simple[0]); notes.append(f'第{n}课 由拼音 {tok} 补回 {simple[0]}')
            elif len(in_book) == 1:
                got.append(in_book[0]); notes.append(f'第{n}课 由拼音 {tok} 补回 {in_book[0]}')
            elif in_book:
                easy = [c for c in in_book if STROKES.get(c, 99) <= 3]
                if len(easy) == 1 and all(STROKES.get(c, 99) >= 6 for c in in_book if c != easy[0]):
                    got.append(easy[0]); notes.append(f'第{n}课 由拼音 {tok} 补回 {easy[0]}（候选里最简单的）')
                else:
                    notes.append(f'第{n}课 拼音 {tok} 有多个候选 {"".join(in_book[:6])}（未加入）')
        for ch, num in pairs.items():
            if num == n and ch not in got and ch not in assigned:
                got.append(ch); notes.append(f'第{n}课 按生字表角标补回 {ch}')
        got = [c for c in got if c in bs or c in SIMPLE]   # 只留生字表里有的字，去掉标题之类的噪声
        assigned.update(got)
        out[str(n)] = got
    unassigned = [c for c in book_set if c not in assigned]
    return {'lessons': out, 'starts': dict(lessons), 'table_pages': tbl_pages, 'book_set': ''.join(book_set), 'unassigned': ''.join(unassigned), 'notes': notes}

def _sim(a, b):
    if a == b: return True
    if abs(len(a) - len(b)) > 1: return False
    d = sum(1 for x, y in zip(a, b) if x != y) + abs(len(a) - len(b))
    return d <= 1 and len(a) >= 3

for stem in sys.argv[1:]:
    r = parse(stem)
    Path(stem + '.lessons.json').write_text(json.dumps(r, ensure_ascii=False, indent=0), encoding='utf-8')
    print(f'===== {stem}: lessons {list(r["starts"].keys())}, table pages {r["table_pages"]}, {len(r["book_set"])} new chars, unassigned {len(r["unassigned"])}: {r["unassigned"]}')
    for k, v in r['lessons'].items(): print(f'  第{k}课 ({len(v)}): {"".join(v)}')
    for n in r['notes']: print('   ·', n)
