#!/usr/bin/env python3
"""Prepare public JPEG derivatives for scheduled Confluence posts.
Never crop the art: pad only where Meta requires the minimum 4:5 portrait."""
from pathlib import Path
from PIL import Image
import sys

if len(sys.argv) != 4:
    raise SystemExit("Usage: prepare-confluence-media.py source.jpg YYYY-MM-DD portrait|landscape")
source, day, orientation = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
if orientation not in ("portrait", "landscape"):
    raise ValueError("Unknown orientation")
if not source.is_file():
    raise FileNotFoundError(source)
base = f"pp-confluence-{day}-{orientation}"
with Image.open(source) as image:
    image = image.convert("RGB")
    main = image
    if orientation == "portrait":
        # 1000x1400 is too narrow for Instagram's 4:5 feed.
        # Add 60px neutral paper on each side, retaining the whole artwork.
        required_width = max(image.width, (image.height * 4 + 4) // 5)
        if required_width > image.width:
            main = Image.new("RGB", (required_width, image.height), "#f5f0e6")
            main.paste(image, ((required_width - image.width) // 2, 0))
    meta = Path("/tmp") / (base + "-meta.jpg")
    main.save(meta, "JPEG", quality=84, optimize=True, progressive=True)
    original = Path("/tmp") / (base + "-original.jpg")
    image.save(original, "JPEG", quality=85, optimize=True, progressive=True)
    blue = Path("/tmp") / (base + "-bluesky.jpg")
    small = image.copy()
    small.thumbnail((1250, 1250), Image.Resampling.LANCZOS)
    for quality in (80, 72, 64, 56, 48, 40):
        small.save(blue, "JPEG", quality=quality, optimize=True, progressive=True)
        if blue.stat().st_size < 900000:
            break
    else:
        raise ValueError("Bluesky JPEG is still too large")
    assert min(main.size) >= 320
    assert (main.width / main.height) >= 0.8 - 0.00001
    assert original.stat().st_size > 12000
    print(f"Prepared {orientation}: original={image.size}, Meta={main.size}, Bluesky={blue.stat().st_size} bytes")
