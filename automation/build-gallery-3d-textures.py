#!/usr/bin/env python3
"""Prebuild gallery-only WebP textures. The full-resolution archive JPEGs stay intact.

Each dated floor gets a small manifest so existing, unoptimised floors can
continue loading without probing for dozens of missing WebP files.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageOps, features

ROOT = Path(__file__).resolve().parent.parent / "gallery"
SIZES = {"desktop": 1100, "mobile": 640}
QUALITIES = {"desktop": 87, "mobile": 85}


def source_for(day_dir, filename):
    if Path(filename).name != filename or Path(filename).suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ValueError(f"Unsafe artwork filename: {filename!r}")
    local = day_dir / filename
    if local.is_file():
        return local
    # Earlier editions sometimes reference files mirrored from Releases.
    mirror = ROOT / "release-art" / filename
    if mirror.is_file():
        return mirror
    raise FileNotFoundError(f"Archived artwork missing: {local} (also checked {mirror})")


def build_day(day_dir):
    meta = json.loads((day_dir / "meta.json").read_text(encoding="utf-8"))
    entries = meta["entries"]
    if not entries:
        raise ValueError(f"No archived artworks in {day_dir}")
    out_dir = day_dir / "3d"
    out_dir.mkdir(exist_ok=True)
    records = {}
    keep = set()

    for entry in entries:
        filename = entry["imageFile"]
        if filename in records:
            raise ValueError(f"Duplicate imageFile in {day_dir}: {filename}")
        source = source_for(day_dir, filename)
        basename = Path(filename).stem
        record = {}
        with Image.open(source) as original:
            rgb = ImageOps.exif_transpose(original)
            rgb = rgb.convert("RGBA" if "A" in rgb.getbands() else "RGB")
            for device, max_edge in SIZES.items():
                name = f"{basename}-{max_edge}.webp"
                output = out_dir / name
                reduced = rgb.copy()
                reduced.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
                reduced.save(output, format="WEBP", quality=QUALITIES[device], method=5)
                with Image.open(output) as check:
                    if check.format != "WEBP" or max(check.size) > max_edge:
                        raise ValueError(f"Bad 3D texture: {output}")
                record[device] = f"3d/{name}"
                keep.add(name)
        records[filename] = record

    # Delete stale variants when a daily queue changes, not archive originals.
    for candidate in out_dir.glob("*.webp"):
        if candidate.name not in keep:
            candidate.unlink()
    manifest = {"version": 1, "sizes": SIZES, "images": records}
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    total_bytes = sum((out_dir / name).stat().st_size for name in keep)
    print(f"{day_dir.name}: {len(records)} studies, {len(keep)} WebP textures, {total_bytes / 1024:.0f} KiB")


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--date", help="Dated exhibition (YYYY-MM-DD)")
    group.add_argument("--all", action="store_true", help="One-time archive backfill")
    args = parser.parse_args()
    if not features.check("webp"):
        raise RuntimeError("Pillow WebP encoder unavailable")
    if args.all:
        days = sorted(p for p in ROOT.iterdir() if p.is_dir() and len(p.name) == 10
                      and p.name[4] == "-" and p.name[7] == "-" and (p / "meta.json").is_file())
    else:
        days = [ROOT / args.date]
    for day in days:
        build_day(day)


if __name__ == "__main__":
    main()
