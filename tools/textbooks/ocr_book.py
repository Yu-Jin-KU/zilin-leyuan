# -*- coding: utf-8 -*-
"""OCR every page of a textbook PDF at 120 dpi -> <stem>.ocr.json  (checkpoints every 10 pages, resumable)
usage: python ocr_book.py zw02.pdf [zw03.pdf ...]"""
import sys, json, time, os
from pathlib import Path
import fitz
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
for arg in sys.argv[1:]:
    pdf = Path(arg); out = Path(str(pdf.with_suffix('')) + '.ocr.json'); part = Path(str(out) + '.part')
    if out.exists(): print(pdf.stem, 'done already'); continue
    d = fitz.open(str(pdf)); pages = []
    if part.exists():
        try: pages = json.loads(part.read_text(encoding='utf-8'))
        except Exception: pages = []
    t0 = time.time(); img = f'_tmp_{pdf.stem}.png'
    for i in range(len(pages), len(d)):
        pix = d[i].get_pixmap(dpi=120); pix.save(img)
        res, _ = ocr(img)
        pages.append([{'y': int(b[0][1]), 'x': int(b[0][0]), 'h': int(b[2][1] - b[0][1]), 'w': int(b[1][0] - b[0][0]), 't': t, 'c': round(float(c), 2)} for b, t, c in (res or [])])
        if i % 10 == 9:
            part.write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
            print(f'{pdf.stem}: {i+1}/{len(d)} {time.time()-t0:.0f}s', flush=True)
    out.write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
    if part.exists(): part.unlink()
    try: os.remove(img)
    except Exception: pass
    print(pdf.stem, 'DONE', len(pages), 'pages', f'{time.time()-t0:.0f}s', flush=True)
