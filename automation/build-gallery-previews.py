#!/usr/bin/env python3
"""Build compact deterministic daily gallery mosaics. Requires Pillow (pip install Pillow)."""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "gallery"
WIDTH, HEIGHT = 840, 600
GAP = 2
PHI = (math.sqrt(5) - 1) / 2

def rectangles(count, date):
    boxes = [(0.0, 0.0, 1.0, 1.0)]
    seed = sum(ord(ch) for ch in date)
    while len(boxes) < count:
        largest = max(range(len(boxes)), key=lambda i: boxes[i][2] * boxes[i][3])
        x, y, w, h = boxes.pop(largest)
        vertical = w >= h
        fraction = PHI if (len(boxes) + seed) % 2 else 1 - PHI
        if vertical:
            boxes.extend(((x, y, w*fraction, h), (x+w*fraction, y, w*(1-fraction), h)))
        else:
            boxes.extend(((x, y, w, h*fraction), (x, y+h*fraction, w, h*(1-fraction))))
    return sorted(boxes, key=lambda b: (b[1], b[0]))

def generate(date, force=False):
    day_dir = ROOT / date
    meta_path = day_dir / "meta.json"
    if not meta_path.is_file():
        return "missing metadata"
    entries = json.loads(meta_path.read_text(encoding="utf-8")).get("entries", [])
    if not entries:
        return "no entries"
    images = []
    for entry in entries:
        name = entry.get("imageFile", "")
        if Path(name).name != name or not name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            return "invalid source filename"
        p = day_dir / name
        if not p.is_file():
            return "missing artwork: " + name
        images.append(p)
    output = day_dir / "archive-preview.jpg"
    newest = max([meta_path.stat().st_mtime] + [p.stat().st_mtime for p in images])
    if not force and output.exists() and output.stat().st_mtime >= newest:
        return "up to date"
    canvas = Image.new("RGB", (WIDTH, HEIGHT), "#f7f2e8")
    for path, (x,y,w,h) in zip(images, rectangles(len(images), date)):
        left, top = round(x*WIDTH), round(y*HEIGHT)
        right, bottom = round((x+w)*WIDTH), round((y+h)*HEIGHT)
        left, top = min(WIDTH-1,max(0,left)), min(HEIGHT-1,max(0,top))
        right, bottom = min(WIDTH,max(left+1,right)), min(HEIGHT,max(top+1,bottom))
        target_w, target_h = max(1,right-left-2*GAP), max(1,bottom-top-2*GAP)
        with Image.open(path) as source:
            source = ImageOps.exif_transpose(source).convert("RGB")
            tile = ImageOps.fit(source, (target_w,target_h), method=Image.Resampling.LANCZOS, centering=(0.5,0.5))
            canvas.paste(tile, (left+GAP,top+GAP))
    canvas.save(output, format="JPEG", quality=78, optimize=True, progressive=True, subsampling=0)
    return f"saved {output.relative_to(ROOT)} ({output.stat().st_size} bytes)"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--date", help="Single YYYY-MM-DD gallery")
    parser.add_argument("--force", action="store_true")
    args=parser.parse_args()
    days=[args.date] if args.date else sorted(p.name for p in ROOT.iterdir() if p.is_dir() and len(p.name)==10)
    failures=[]
    for day in days:
        try:
            result=generate(day,args.force)
            print(f"{day}: {result}")
            if result.startswith(("invalid", "missing artwork")):
                failures.append(day)
        except Exception as ex:
            failures.append(day)
            print(f"{day}: ERROR {ex}")
    if failures:
        raise SystemExit("Mosaics incomplete: "+", ".join(failures))

if __name__=="__main__":
    main()
