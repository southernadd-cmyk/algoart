#!/usr/bin/env python3
"""Release A: read, validate, copy and restore ONE complete dated gallery edition.

Never edits source repo, production bucket, gallery files or publishing workflows.
All R2 media objects use an isolated unique test-only prefix and are deleted.
An exact byte-level restored copy is checked before cleanup.
The test does NOT constitute a durable independent offsite backup.
"""
from __future__ import annotations

import base64
import gzip
import hashlib
from html.parser import HTMLParser
import json
import mimetypes
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

DATE = "2026-11-09"
REPO = "southernadd-cmyk/algoart"
BRANCH = "refs/heads/plan/archive-storage-foundation-20261109"
BUCKET = "proportion-piece-archive-test"
SOURCE_PREFIX = "gallery/" + DATE + "/"
PREFIX_PATTERN = re.compile(r"_release-a-edition-test/[0-9]+/[0-9]+/gallery/" + DATE + "/")
IMAGE_RE = re.compile(r"[-\w.]+\.jpe?g$", re.I)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError("Missing environment setting " + name)
    return value


def assert_safe_path(path: str) -> None:
    if not path.startswith(SOURCE_PREFIX):
        raise ValueError("Unexpected file outside test date: " + path)
    suffix = path[len(SOURCE_PREFIX):]
    if not suffix or "\\" in suffix or Path(suffix).is_absolute() or ".." in Path(suffix).parts:
        raise ValueError("Unsafe media path: " + path)


def read_json(base: Path, name: str):
    return json.loads((base / name).read_text(encoding="utf8"))


def decode_confluence(record: dict) -> dict:
    from urllib.parse import urlsplit, parse_qs

    url = urlsplit(record["shareUrl"])
    if url.hostname != "southernadd-cmyk.github.io" or url.path != "/algoart/confluence/":
        raise ValueError("Unexpected Confluence share destination: " + record["id"])
    raw = parse_qs(url.query).get("s", [])
    if len(raw) != 1:
        raise ValueError("Missing Confluence full state: " + record["id"])
    token = raw[0]
    padded = token + "=" * (-len(token) % 4)
    state = json.loads(base64.urlsafe_b64decode(padded).decode("utf8"))
    if state.get("seed") != record["seed"]:
        raise ValueError("Confluence seed mismatch: " + record["id"])
    if state.get("orientation") != record["orientation"]:
        raise ValueError("Confluence format mismatch: " + record["id"])
    artists = state.get("artists")
    if not isinstance(artists, list) or len(artists) != 3:
        raise ValueError("Confluence must preserve three artists: " + record["id"])
    for artist in artists:
        if not all(artist.get(k) for k in ("system", "palette", "material")):
            raise ValueError("Missing Confluence artist system/material/palette: " + record["id"])
        if not isinstance(artist.get("settings"), dict) or not artist["settings"]:
            raise ValueError("Missing full individual artist settings: " + record["id"])
    return state


class Cards(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cards = 0
        self.images = []
        self.in_card = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "article" and "art-card" in a.get("class", "").split():
            self.cards += 1
            self.in_card += 1
        if self.in_card and tag == "img" and a.get("src"):
            self.images.append(a["src"])

    def handle_endtag(self, tag):
        if tag == "article" and self.in_card:
            self.in_card -= 1


def validate_edition(root: Path, files: list[str]) -> dict:
    from PIL import Image

    all_paths = set(files)
    base = root / "gallery" / DATE
    meta = read_json(base, "meta.json")
    texture = read_json(base, "3d/manifest.json")
    if meta.get("date") != DATE or meta.get("count") != 16 or len(meta.get("entries", [])) != 16:
        raise ValueError("Published day is not a complete 16-artwork edition")
    entries = meta["entries"]
    solos = [e for e in entries if re.fullmatch(DATE + r"-G\d{2}", e.get("id", ""))]
    collabs = [e for e in entries if re.fullmatch(DATE + r"-C\d{2}", e.get("id", ""))]
    if len(solos) != 12 or len(collabs) != 4 or len({e["id"] for e in entries}) != 16:
        raise ValueError("Expected 12 solo and 4 distinct Confluence artworks")
    if sum(e.get("orientation") == "portrait" for e in collabs) != 2 or \
       sum(e.get("orientation") == "landscape" for e in collabs) != 2:
        raise ValueError("Confluence portrait/landscape distribution wrong")
    if set(texture.get("images", {})) != {e["imageFile"] for e in entries}:
        raise ValueError("3D texture manifest does not cover exactly all 16 gallery artworks")
    if texture.get("version") != 1:
        raise ValueError("Unexpected 3D manifest version")

    cards = Cards()
    cards.feed((base / "index.html").read_text("utf8"))
    if cards.cards != 16:
        raise ValueError("Daily HTML does not contain exactly 16 artwork cards")
    if set(cards.images) != {e["imageFile"] for e in entries}:
        raise ValueError("Daily HTML image references differ from metadata")

    v2 = {
        "schemaVersion": 2,
        "proposalOnly": True,
        "readyForPublication": False,
        "date": DATE,
        "count": 16,
        "originalPublicURLsUnchanged": True,
        "entries": [],
    }
    portrait_names = set()
    for e in entries:
        name = e.get("imageFile")
        if not isinstance(name, str) or not IMAGE_RE.fullmatch(name):
            raise ValueError("Unsafe or invalid original image name")
        original_path = SOURCE_PREFIX + name
        if original_path not in all_paths:
            raise ValueError("Missing published original: " + original_path)
        if e.get("rendererVersion") != 10 or not e.get("seed") or \
           not e.get("settings") or not e.get("shareUrl"):
            raise ValueError("Missing renderer/version/state: " + e["id"])
        with Image.open(base / name) as image:
            image.verify()
        with Image.open(base / name) as image:
            w, h = image.size
            if image.format != "JPEG":
                raise ValueError("Original not JPEG: " + name)
            if (e.get("orientation") == "portrait") != (h > w):
                raise ValueError("Artwork orientation wrong: " + name)
            if min(w, h) < 1000:
                raise ValueError("Original resolution unexpectedly small: " + name)
        if e.get("orientation") == "portrait":
            portrait_names.add(name)

        variants = texture["images"][name]
        vfiles = {}
        for device in ("mobile", "desktop"):
            variant = variants.get(device)
            if not isinstance(variant, str) or not variant.startswith("3d/"):
                raise ValueError("Missing " + device + " variant for " + name)
            rel = SOURCE_PREFIX + variant
            if rel not in all_paths:
                raise ValueError("Missing actual " + device + " file: " + variant)
            with Image.open(root / rel) as image:
                image.verify()
            with Image.open(root / rel) as image:
                width, height = image.size
                if image.format != "WEBP" or max(width, height) > (640 if device == "mobile" else 1100):
                    raise ValueError("Invalid " + device + " texture: " + variant)
            b = (root / rel).read_bytes()
            vfiles[device] = {"path": rel, "sha256": digest(b), "bytes": len(b)}
        orig = (root / original_path).read_bytes()
        state = decode_confluence(e) if e.get("material") == "confluence" else None
        if e in collabs and state is None:
            raise ValueError("Confluence entry missing complete state")
        v2["entries"].append({
            "id": e["id"], "imageFile": name, "shareUrl": e["shareUrl"],
            "rendererVersion": e["rendererVersion"], "seed": e["seed"],
            "orientation": e["orientation"], "material": e.get("material", "marker"),
            "original": {"path": original_path, "sha256": digest(orig), "bytes": len(orig)},
            "optimized": vfiles,
            "confluenceState": state,
        })

    pack_path = SOURCE_PREFIX + "3d/sculptures.json.gz"
    if pack_path not in all_paths:
        raise ValueError("Portrait sculpture pack missing")
    data = json.loads(gzip.decompress((root / pack_path).read_bytes()))
    if data.get("version") != 1 or data.get("date") != DATE:
        raise ValueError("Invalid portrait sculpture pack identity")
    if set(data.get("studies", {})) != portrait_names:
        raise ValueError("Sculpture pack does not map to every portrait artwork")
    for name, variants in data["studies"].items():
        if not variants.get("mobile") or not variants.get("desktop"):
            raise ValueError("Incomplete sculpture quality variants: " + name)
    if SOURCE_PREFIX + "archive-preview.jpg" not in all_paths:
        raise ValueError("Missing archive cover")
    v2["sculpture"] = {
        "path": pack_path,
        "sha256": digest((root / pack_path).read_bytes()),
        "bytes": (root / pack_path).stat().st_size,
        "portraits": len(portrait_names),
    }
    return {"edition": v2, "solo": len(solos), "confluence": len(collabs),
            "originals": len(entries), "variants": len(entries) * 2,
            "portraits": len(portrait_names), "htmlCards": cards.cards}


def list_source_files(source: Path) -> list[str]:
    files = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "gallery/" + DATE],
        cwd=source,
    ).decode("utf8").split("\0")
    result = sorted(x for x in files if x)
    if not result:
        raise ValueError("No tracked files in published dated gallery")
    for f in result:
        assert_safe_path(f)
        p = source / f
        if not p.is_file() or p.is_symlink():
            raise ValueError("Missing or symbolic-link source: " + f)
    return result


def make_client():
    import boto3
    from botocore.config import Config
    account = require("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
        raise ValueError("Invalid R2 account ID")
    return boto3.client(
        "s3",
        endpoint_url="https://" + account + ".r2.cloudflarestorage.com",
        region_name="auto",
        aws_access_key_id=require("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=require("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4", connect_timeout=15, read_timeout=30,
                      retries={"max_attempts": 2},
                      s3={"addressing_style": "path"}),
    )


def is_missing(error: Exception) -> bool:
    return str(getattr(error, "response", {}).get("Error", {}).get("Code")) in (
        "404", "NotFound", "NoSuchKey"
    )


def execute():
    if require("GITHUB_REPOSITORY") != REPO or require("GITHUB_REF") != BRANCH or \
       require("GITHUB_EVENT_NAME") != "push":
        raise ValueError("Must run as isolated-branch push, not on production")
    if require("R2_BUCKET") != BUCKET:
        raise ValueError("Refusing any bucket other than the exact test bucket")
    run_id = require("GITHUB_RUN_ID")
    attempt = require("GITHUB_RUN_ATTEMPT")
    if not run_id.isdecimal() or not attempt.isdecimal():
        raise ValueError("Invalid CI run identifier")
    scratch = "_release-a-edition-test/" + run_id + "/" + attempt + "/"
    if not PREFIX_PATTERN.fullmatch(scratch + SOURCE_PREFIX):
        raise ValueError("Invalid scratch prefix")
    source = Path("live-snapshot").resolve()
    if not (source / ".git").exists():
        raise ValueError("Expected separate read-only main checkout")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source,
                                     text=True).strip()
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=source).strip():
        raise ValueError("Live snapshot has uncommitted files")
    files = list_source_files(source)
    before = validate_edition(source, files)
    original_hashes = {name: digest((source / name).read_bytes()) for name in files}

    report_dir = Path(require("R2_EDITION_REPORT_DIR")).resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "schemaVersion": 1,
        "purpose": "Release A one-date byte-perfect storage and restore rehearsal",
        "publishedSourceCommit": commit, "date": DATE,
        "bucket": BUCKET, "scratchPrefix": scratch,
        "originalFiles": len(files), "originalBytes": sum((source / f).stat().st_size for f in files),
        "expectedSHA256": original_hashes,
        "validation": {k: v for k, v in before.items() if k != "edition"},
        "remotePutHeadGet": False, "restoredAllBytes": False, "scratchRemoved": False,
        "notProduction": True,
        "notIndependentOffsiteBackup": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # The object key and full report are intentionally ephemeral.
    client = make_client()
    attempted = []
    cleanup_error = None
    try:
        # Preflight: never overwrite any pre-existing R2 object.
        for name in files:
            key = scratch + name
            try:
                client.head_object(Bucket=BUCKET, Key=key)
            except Exception as error:
                if not is_missing(error):
                    raise
            else:
                raise ValueError("Test prefix already contains an object; refusing overwrite")

        for name in files:
            key = scratch + name
            data = (source / name).read_bytes()
            sha = original_hashes[name]
            attempted.append(key)  # Include uncertain writes in cleanup.
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
            client.put_object(Bucket=BUCKET, Key=key, Body=data,
                              ContentType=content_type, CacheControl="no-store",
                              Metadata={"sha256": sha})
            metadata = client.head_object(Bucket=BUCKET, Key=key)
            if metadata.get("ContentLength") != len(data) or \
               metadata.get("Metadata", {}).get("sha256") != sha:
                raise ValueError("Uploaded object HEAD metadata mismatch: " + name)
        report["uploadedFiles"] = len(attempted)
        print("R2 upload and HEAD verification:", len(files), "tracked dated files")

        with tempfile.TemporaryDirectory(prefix="pp-r2-restore-") as temp:
            restored = Path(temp)
            for name in files:
                key = scratch + name
                response = client.get_object(Bucket=BUCKET, Key=key)
                returned = response["Body"].read()
                if digest(returned) != original_hashes[name] or \
                   len(returned) != (source / name).stat().st_size:
                    raise ValueError("Remote download hash mismatch: " + name)
                target = restored / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(returned)
            report["remotePutHeadGet"] = True
            print("R2 downloaded byte checksums:", len(files), "PASS")
            after = validate_edition(restored, files)
            if before["edition"] != after["edition"]:
                raise ValueError("Reconstructed metadata/Confluence state differs")
            for name in files:
                if digest((restored / name).read_bytes()) != original_hashes[name]:
                    raise ValueError("Restored file hash mismatch: " + name)
            report["restoredAllBytes"] = True
            report["restoredValidation"] = {k: v for k, v in after.items() if k != "edition"}
            report["v2ManifestSha256"] = digest(
                json.dumps(before["edition"],sort_keys=True,separators=(",",":")).encode("utf8")
            )
            print("Restored entire published edition and validated 16 artworks,",
                  "32 textures, Confluence state, sculptures, HTML: PASS")
        report["status"] = "verified"
    finally:
        # No prefix listing and no bulk delete outside exact attempted scratch keys.
        if attempted:
            try:
                for start in range(0, len(attempted), 100):
                    batch = attempted[start:start+100]
                    result = client.delete_objects(
                        Bucket=BUCKET, Delete={"Objects": [{"Key": k} for k in batch],
                                               "Quiet": False})
                    if result.get("Errors"):
                        raise RuntimeError("Cloud storage reported failed test-key deletions")
                for key in attempted:
                    try:
                        client.head_object(Bucket=BUCKET, Key=key)
                    except Exception as error:
                        if not is_missing(error):
                            raise
                    else:
                        raise RuntimeError("Scratch object still present after cleanup")
                report["scratchRemoved"] = True
                print("Scratch key deletion and absence verification:", len(attempted), "PASS")
            except Exception as err:
                cleanup_error = err
                report["scratchRemoved"] = False
                print("Scratch cleanup FAILED; manual inspection required",file=sys.stderr)
        (report_dir / "edition-roundtrip-report.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8"
        )
        (report_dir / "README.txt").write_text(
            "R2 round-trip test of one 2026-11-09 gallery edition.\n"
            "Files are not retained in R2 after a successful test.\n"
            "The report is not a durable independent offsite backup.\n"
            "All original production gallery files remain unchanged.\n", encoding="utf8"
        )
        if cleanup_error is not None:
            raise RuntimeError("Test object cleanup failed") from cleanup_error
    if not report["restoredAllBytes"] or not report["scratchRemoved"]:
        raise RuntimeError("Verification or cleanup did not complete")
    print("RELEASE A EDITION R2 ROUND-TRIP PASSED")


if __name__ == "__main__":
    try:
        execute()
    except Exception as e:
        # Never display credentials or full cloud endpoint.
        print("Release A edition test failed:", type(e).__name__, str(e).splitlines()[0][:180],
              file=sys.stderr)
        sys.exit(1)
