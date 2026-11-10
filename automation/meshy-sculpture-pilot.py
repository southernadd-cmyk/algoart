"""One painting -> one genuine Meshy image-to-3D generated GLB.

Safe by design:
- explicit --confirm-spend YES plus MESHY_API_KEY required for paid API call
- dry-run validates archive and JSON request without requesting any service
- never print API credentials, source base64 payload, or signed model URLs
- GitHub Actions artifact only; no changes to production sculptures or image archive
"""
from __future__ import annotations
import argparse
import base64
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib import request, error, parse

API = "https://api.meshy.ai/openapi/v1/image-to-3d"
ROOT = Path(__file__).resolve().parents[1]
LIMIT = 20 * 1024 * 1024
OUT_LIMIT = 45 * 1024 * 1024


def select_source(day: str, image_file: str, root: Path = ROOT):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("Date must be YYYY-MM-DD")
    if not re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z._-]{0,180}\.(?:jpg|jpeg|png|webp)", image_file, re.I):
        raise ValueError("Supply a plain archived image filename")
    directory = root / "gallery" / day
    meta = json.loads((directory / "meta.json").read_text(encoding="utf-8"))
    matches = [e for e in meta.get("entries", []) if e.get("imageFile") == image_file]
    if len(matches) != 1 or matches[0].get("orientation") != "portrait":
        raise ValueError("Choose exactly one archived portrait from that day's meta.json")
    if matches[0].get("material") == "confluence":
        raise ValueError("Confluence portraits remain excluded from sculpture generation")
    path = directory / image_file
    if not path.is_file() or not (32 < path.stat().st_size <= LIMIT):
        raise ValueError("Source image missing or exceeds provider input limit")
    return path, matches[0]


def source_payload(path: Path, ai_model: str = "meshy-7.1"):
    mime = "image/png" if path.suffix.lower() == ".png" else (
        "image/webp" if path.suffix.lower() == ".webp" else "image/jpeg")
    return {
        "image_url": "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode("ascii"),
        "ai_model": ai_model,
        "model_type": "standard",
        "geometry_resolution": "standard",
        "should_texture": True,
        # N1 uses the source as the texture reference. No text-generated repaint.
        "texture_model": "meshy-n1",
        "target_formats": ["glb"],
    }


def json_request(url: str, token: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data,
                          headers={"Authorization": f"Bearer {token}",
                                   "Content-Type": "application/json",
                                   "Accept": "application/json"},
                          method="POST" if payload is not None else "GET")
    with request.urlopen(req, timeout=75) as res:
        value = json.loads(res.read(3_000_000))
        retry = res.headers.get("Retry-After")
        return value, (int(retry) if retry and retry.isdigit() else 12)


def download_glb(url: str, path: Path):
    parsed = parse.urlsplit(url)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".meshy.ai"):
        raise ValueError("Unexpected model download host")
    with request.urlopen(request.Request(url, headers={"Accept": "model/gltf-binary"}),
                         timeout=120) as response:
        chunks = []
        total = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk: break
            total += len(chunk)
            if total > OUT_LIMIT:
                raise ValueError("Generated GLB exceeds the lab's 45 MB limit")
            chunks.append(chunk)
    content = b"".join(chunks)
    if len(content) < 20 or content[:4] != b"glTF":
        raise ValueError("Provider output is not a GLB")
    path.write_bytes(content)
    return len(content)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True)
    parser.add_argument("--image-file", required=True)
    parser.add_argument("--out", default="meshy-pilot-output")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--confirm-spend", default="NO")
    args = parser.parse_args()
    src, entry = select_source(args.date, args.image_file)
    print(f"Source: {args.date} / {src.name}")
    print(f"Portrait: {entry.get('title') or entry.get('id')}")
    print(f"Source bytes: {src.stat().st_size}")
    print("Model: meshy-7.1 / standard / image referenced 2K N1 texture / GLB")
    print("Paid API call: " + ("NO (dry-run)" if args.dry_run else "YES (explicit manual run)"))
    if args.dry_run:
        return
    if args.confirm_spend != "YES":
        raise ValueError("No paid generation without --confirm-spend YES")
    key = os.environ.get("MESHY_API_KEY", "").strip()
    if not key:
        raise ValueError("Set the MESHY_API_KEY GitHub Actions secret; never put it in source")
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    payload = source_payload(src)
    created, _ = json_request(API, key, payload)
    task_id = created.get("result", "")
    if not re.fullmatch(r"[0-9a-fA-F-]{30,50}", str(task_id)):
        raise RuntimeError("Meshy did not return a valid task ID")
    print("Image-to-3D task accepted; checking completion")
    deadline = time.monotonic() + 30 * 60
    result = {}
    while time.monotonic() < deadline:
        result, interval = json_request(f"{API}/{task_id}", key)
        status = result.get("status")
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "CANCELED", "CANCELLED"):
            raise RuntimeError(f"Meshy task stopped: {status}")
        if status not in ("PENDING", "IN_PROGRESS"):
            raise RuntimeError("Unrecognised Meshy task status")
        print(f"Status: {status}, progress: {result.get('progress', 0)}%")
        time.sleep(min(50, max(5, interval)))
    else:
        raise RuntimeError("Meshy did not finish before the 30-minute workflow limit")
    url = result.get("model_urls", {}).get("glb")
    if not url:
        raise RuntimeError("Meshy reported success without a GLB model")
    total = download_glb(url, output / "model.glb")
    (output / "source.jpg").write_bytes(src.read_bytes()) if src.suffix.lower() in (".jpg", ".jpeg") else None
    metadata = {
        "provider": "meshy", "task_id": task_id, "model": "meshy-7.1",
        "source_date": args.date, "image_file": src.name,
        "title": entry.get("title"), "seed": entry.get("seed"),
        "model_bytes": total, "provider_credits": result.get("consumed_credits"),
        "source_image_sha256": __import__("hashlib").sha256(src.read_bytes()).hexdigest()
    }
    (output / "model-info.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    (output / "README.txt").write_text(
        "PROPORTION PIECE — one-image AI sculpture pilot\n"
        "1. Open https://southernadd-cmyk.github.io/algoart/gallery/sculpture-lab/\n"
        "2. Select the source date and portrait in model-info.json.\n"
        "3. Select a plinth, then 'Load GLB model(s)' and choose model.glb.\n"
        "4. Orbit to judge true 360-degree sculpture and source relationship.\n"
        "No changes were made to the daily tower or archived images.\n",
        encoding="utf-8")
    print(f"Generated a genuine textured model ({total:,} bytes). GitHub Actions artifact ready.")


if __name__ == "__main__":
    try:
        run()
    except (OSError, ValueError, RuntimeError, error.HTTPError, error.URLError) as exc:
        # API failures never contain the token because headers are never printed.
        print(f"Meshy pilot failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
