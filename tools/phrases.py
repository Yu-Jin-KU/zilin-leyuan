# -*- coding: utf-8 -*-
"""字灵乐园要朗读的全部文本（gen_audio.py 和 qa_audio.py 共用）。

来源：index.html 里的 DATA 字表 + tools/pinyin.json 的拼音表。
"""
import re, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

TONES = {"ā":"a1","á":"a2","ǎ":"a3","à":"a4","ē":"e1","é":"e2","ě":"e3","è":"e4","ī":"i1","í":"i2","ǐ":"i3","ì":"i4",
         "ō":"o1","ó":"o2","ǒ":"o3","ò":"o4","ū":"u1","ú":"u2","ǔ":"u3","ù":"u4","ǖ":"v1","ǘ":"v2","ǚ":"v3","ǜ":"v4","ü":"v","ń":"n2","ň":"n3","ǹ":"n4","ḿ":"m2"}

def numbered(py):
    """带调拼音 -> 数字调（yī -> yi1；没有声调符号则记为轻声 5）"""
    py = py.split("/")[0].split(",")[0].split(" ")[0].strip()
    tone = ""; out = ""
    for ch in py:
        if ch in TONES:
            v = TONES[ch]; out += v[0]
            if len(v) > 1: tone = v[1]
        elif ch.isalpha(): out += ch
        else: return None
    return (out + (tone or "5")) if out else None

def load_data():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    return json.loads(re.search(r"^const DATA=(\[\[.*?\]\]);", html, re.M).group(1))

def load_pinyin():
    return json.loads((ROOT / "tools" / "pinyin.json").read_text(encoding="utf-8"))

UI = {
    "ui_intro": "先看一遍笔顺，再自己写！",
    "ui_watch": "看好每一笔的方向哦。",
    "ui_start": "一笔一笔写，写对会变颜色。",
    "ui_hint": "看，闪光的地方就是下一笔。",
    "ui_retry": "再试一次，注意从哪里开始写。",
    "ui_good1": "真棒！", "ui_good2": "对啦！", "ui_good3": "好样的！", "ui_good4": "继续！",
    "ui_good5": "太厉害了！", "ui_good6": "写得真好看！", "ui_good7": "你做到了！", "ui_good8": "一笔不差！",
    "ui_summon": "召唤成功！", "ui_evolve": "进化啦！", "ui_again3": "又是三颗星！字灵大王为你骄傲。",
    "ui_keep": "你的最好成绩不会变少，再试一次吧。",
    "ui_star1": "一颗星。", "ui_star2": "两颗星。", "ui_star3": "三颗星！",
    "ui_who": "谁来写字？点自己的名字。",
    "ui_welcome": "欢迎来到字灵乐园！写对一个字，就能召唤一只字灵。",
    "ui_tryagain": "没关系，再来一次！",
    "ui_almost": "就差一点点，加油！",
    "ui_hatch": "孵化啦！新朋友出来了！",
    "ui_card": "字卡到手！",
    "ui_crack": "蛋在动，再写几个字它就出来了。",
    "ui_chief": "部落集齐啦！你是族长！",
}

def char_phrase(row):
    """汉字：先单独读一遍字，再读诗句 / 词语。
    单字用 Fish 的注音标签代替（标签是“替换”不是“标注”：写成 字+标签 会把字读两遍），保证多音字按字表读音。"""
    c, py, line = row[0], row[1], row[5]
    n = numbered(py)
    head = f"<|phoneme_start|>{n}<|phoneme_end|>" if n else c
    return f"{head}。{line}"

def pinyin_phrase(key, item):
    """拼音：读音，儿歌（儿歌里的字母替换成读音）"""
    say = item["say"]
    line = re.sub(r"[a-zü]+", say, item["line"])
    return f"{say}，{line}"

def all_phrases():
    """返回 [(key, text)]，key 就是 audio/<key>.mp3 的文件名"""
    out = []
    py = load_pinyin()
    for g in py["groups"]:
        for k in g["items"]:
            out.append((k, pinyin_phrase(k, py["items"][k])))
    for r in load_data():
        out.append((r[0], char_phrase(r)))
    for k, t in UI.items():
        out.append((k, t))
    return out

if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ph = all_phrases()
    print(len(ph), "条")
    for k, t in ph[:70]: print(k, "|", t)
