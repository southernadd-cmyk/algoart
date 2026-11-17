#!/usr/bin/env python3
"""Publish a complete, independently audited sculpture preset as a new R2 release."""
import argparse
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRESET_ID = "assembly-100-100-40-95"
PRESET = json.loads((ROOT / "gallery/sculpture-v2-test/sculpture-presets.json").read_text())["presets"][PRESET_ID]
REVISION = "v4.2.1-v2-pigment-island-fix"
PREFIX = "sculptures-v2/" + PRESET["release"]
SPEC = importlib.util.spec_from_file_location("immutable_storage", ROOT / "automation/upload-sculpture-v2-r2.py")
storage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(storage)


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def asset(entries, file, label, content_type, expected=None):
    data = file.read_bytes()
    checksum = sha(data)
    require(expected is None or expected == checksum, "Asset checksum differs: " + label)
    suffix = ".json.gz" if content_type == "application/gzip" else file.suffix
    key = f"{PREFIX}/{label}/{checksum}{suffix}"
    require(key.startswith(PREFIX + "/") and ".." not in key and len(key) <= 320, "Invalid release key")
    entry = {"path": str(file), "key": key, "sha256": checksum, "bytes": len(data),
             "contentType": content_type, "url": storage.WORKER + "/" + key, "label": label}
    entries.append(entry)
    return {field: entry[field] for field in ("sha256", "bytes", "url")}


def audit_pack(file, date, quality, roster, source_dir):
    data = file.read_bytes()
    require(1000 < len(data) < 45 * 1048576, "Invalid compressed pack size")
    pack = json.loads(gzip.decompress(data))
    require(pack.get("schema") == "pp-sculpture-v2-floor" and pack.get("version") == 2 and
            pack.get("date") == date and pack.get("quality") == quality and
            pack.get("geometryRevision") == REVISION and pack.get("method") == "assembly" and
            pack.get("presetId") == PRESET_ID and pack.get("parameters") == PRESET["parameters"] and
            pack.get("complete") is True and pack.get("expectedPortraits") == len(roster) and
            pack.get("bakedPortraits") == len(roster) and
            set(pack.get("studies", {})) == set(roster), "Incomplete preset pack: " + date + "/" + quality)
    for filename, study in pack["studies"].items():
        require(study.get("imageFile") == filename and study.get("sourceFile") == filename and
                study.get("seed") == roster[filename]["seed"] and study.get("method") == "assembly" and
                study.get("presetId") == PRESET_ID and study.get("parameters") == PRESET["parameters"] and
                study.get("geometryRevision") == REVISION and study.get("quality") == quality and
                study.get("coverage") == 1 and study.get("omittedCells") == 0 and
                study.get("regionCount", 0) > 0 and study.get("triangleCount", 0) > 0,
                "Unapproved preset study: " + filename)
        source = (source_dir / filename).read_bytes()
        require(sha(source) == study.get("sourceSha256"), "Painting hash differs: " + filename)
    return sha(data)


def inventory(history, reception, gallery):
    report = json.loads((history / "bake-report.json").read_text())
    dates = sorted(d["date"] for d in json.loads((gallery / "archive.json").read_text())["days"])
    require(report.get("schema") == "pp-sculpture-v2-bake-report" and
            report.get("mode") == "historical" and report.get("failed") == 0 and
            report.get("presetId") == PRESET_ID and report.get("parameters") == PRESET["parameters"] and
            report.get("qualityVariants") == ["desktop", "mobile"] and
            report.get("sourceDateCount") == len(dates) and
            sorted(d["date"] for d in report.get("days", [])) == dates,
            "Preset bake must visit the complete published archive")
    entries = []
    catalog = {"schema": "pp-sculpture-v2-r2-catalog", "version": 1,
               "release": PRESET["release"], "presetId": PRESET_ID,
               "parameters": PRESET["parameters"], "geometryRevision": REVISION,
               "worker": storage.WORKER, "bucket": storage.BUCKET,
               "builderCommit": report["builderCommit"], "sourceRun": os.environ.get("GITHUB_RUN_ID"),
               "days": {}, "reception": {}}
    total = 0
    for date in dates:
        meta = json.loads((gallery / date / "meta.json").read_text())
        roster = {e["imageFile"]: e for e in meta["entries"]
                  if e.get("orientation") == "portrait" and e.get("material") != "confluence"}
        spec = {"portraits": len(roster), "qualities": {}}
        catalog["days"][date] = spec
        if not roster:
            continue
        folder = history / date / "3d/v2"
        manifest = json.loads((folder / "manifest.json").read_text())
        require(manifest.get("date") == date and manifest.get("presetId") == PRESET_ID and
                manifest.get("parameters") == PRESET["parameters"] and
                manifest.get("expectedPortraits") == len(roster) and manifest.get("samplesOnly") is False,
                "Preset floor manifest differs: " + date)
        for quality in ("desktop", "mobile"):
            file = folder / f"sculptures.{quality}.json.gz"
            checksum = audit_pack(file, date, quality, roster, gallery / date)
            require(manifest["qualities"][quality]["sha256"] == checksum, "Floor manifest hash differs")
            spec["qualities"][quality] = asset(entries, file, f"floors/{date}/{quality}", "application/gzip", checksum)
            total += len(roster)
    require(total == report["attempted"], "Audited model inventory differs from bake report")
    source = json.loads((reception / "source.json").read_text())
    image_file = "recursive-divisions-portrait.png"
    image = reception / image_file
    require(source["seed"] == "PP-RECEPTION-RECTS-P-20261110" and
            source["orientation"] == "portrait" and source["sourceSha256"] == sha(image.read_bytes()),
            "Reception original changed")
    catalog["reception"]["image"] = asset(entries, image, "reception/image", "image/png", source["sourceSha256"])
    for name in ("source", "manifest"):
        catalog["reception"][name] = asset(entries, reception / (name + ".json"), "reception/" + name, "application/json")
    roster = {image_file: {"seed": source["seed"]}}
    for quality in ("desktop", "mobile"):
        file = reception / f"sculptures.{quality}.json.gz"
        checksum = audit_pack(file, "reception", quality, roster, reception)
        catalog["reception"][quality] = asset(entries, file, "reception/" + quality, "application/gzip", checksum)
    catalog_file = history / "r2-preset-catalog.json"
    catalog_file.write_text(json.dumps(catalog, sort_keys=True, separators=(",", ":")) + "\n")
    spec = asset(entries, catalog_file, "catalog", "application/json")
    publication = {"presetId": PRESET_ID, "release": PRESET["release"],
                   "parameters": PRESET["parameters"], "catalog": spec,
                   "days": len(dates), "portraits": total // 2, "reception": True,
                   "objects": len(entries), "bytes": sum(e["bytes"] for e in entries)}
    (history / "release-publication.json").write_text(json.dumps(publication, indent=2) + "\n")
    return entries, publication


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("historical", type=Path)
    parser.add_argument("reception", type=Path)
    parser.add_argument("--gallery", type=Path, default=ROOT / "gallery")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    entries, publication = inventory(args.historical, args.reception, args.gallery)
    if not args.dry_run:
        client = storage.connect()
        client.head_bucket(Bucket=storage.BUCKET)
        # Catalog is last: no discovery document appears before its assets verify.
        for i, entry in enumerate(entries, 1):
            storage.persist(client, entry)
            storage.verify_public(entry)
            print("PRESET_R2_VERIFIED", i, len(entries), entry["label"], entry["bytes"], flush=True)
    print("PRESET_RELEASE_COMPLETE " + json.dumps({**publication, "dryRun": args.dry_run}), flush=True)


if __name__ == "__main__":
    main()
