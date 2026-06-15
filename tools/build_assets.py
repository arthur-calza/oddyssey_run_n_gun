"""
build_assets.py — turn the static concept PNGs into clean, background-free,
consistently-sized character sprite assets the game loads directly.

The concepts ship on an opaque light "transparency checkerboard" background
(no real alpha), so we chroma-key it out with a border flood-fill, trim, and
resize. Run:  py -3 tools/build_assets.py
Reads ./concept/*.png  ->  writes ./assets/<key>.png  (+ assets/manifest.json)
"""
import os, json
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "concept")
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

MAP = {
    "concept_player_1.png":              ("ragnarok",  150),
    "concept_player_2.png":              ("zracks",    150),
    "concept_zombie_1.png":              ("zombie",    150),
    "concept_werewolf_1.png":            ("werewolf",  150),
    "concept_dragon_man_1.png":          ("dragonman", 168),
    "concept_demon_1.png":               ("demon",     176),
    "concept_devorador_de_mentes_1.png": ("flayer",    240),
}

WORK_H = 512            # keying resolution (NEAREST keeps hard edges -> no halos)
ALPHA_TRIM = 16


def is_bg(r, g, b):
    mx = max(r, g, b); mn = min(r, g, b)
    return mx >= 150 and (mx - mn) <= 30   # light + low-saturation = the checkerboard


def chroma_key(im):
    """Flood-fill the connected light-gray background from the borders to alpha 0."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    def consider(x, y):
        i = y * w + x
        if seen[i]: return
        r, g, b, a = px[x, y]
        if is_bg(r, g, b):
            seen[i] = 1; q.append((x, y))
    for x in range(w):
        consider(x, 0); consider(x, h - 1)
    for y in range(h):
        consider(0, y); consider(w - 1, y)
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        if x > 0: consider(x - 1, y)
        if x < w - 1: consider(x + 1, y)
        if y > 0: consider(x, y - 1)
        if y < h - 1: consider(x, y + 1)
    return im


def trim(im):
    a = im.split()[3].point(lambda v: 255 if v >= ALPHA_TRIM else 0)
    bbox = a.getbbox()
    return im.crop(bbox) if bbox else im


def process(fname, key, target_h):
    im = Image.open(os.path.join(SRC, fname)).convert("RGBA")
    # downscale to working res with NEAREST so the checkerboard stays hard-edged
    w, h = im.size
    im = im.resize((round(w * WORK_H / h), WORK_H), Image.NEAREST)
    im = chroma_key(im)
    im = trim(im)
    # final clean resize against transparency
    w2, h2 = im.size
    im = im.resize((max(1, round(w2 * target_h / h2)), target_h), Image.LANCZOS)
    im.save(os.path.join(OUT, key + ".png"))
    return {"w": im.size[0], "h": im.size[1]}


def main():
    manifest = {}
    for fname, (key, th) in MAP.items():
        path = os.path.join(SRC, fname)
        if not os.path.exists(path):
            print("MISSING", path); continue
        manifest[key] = process(fname, key, th)
        print("ok", key, manifest[key])
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print("wrote", len(manifest), "assets")


if __name__ == "__main__":
    main()
