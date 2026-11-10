#!/usr/bin/env python3
"""Persist audited V2 sculptures to the existing R2 media bucket; never touch V1."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from urllib.request import Request, urlopen

BUCKET = "proportion-piece-media-test"
WORKER = "https://proportion-piece-media.mr-adam-clement.workers.dev"
ORIGIN = "https://southernadd-cmyk.github.io"
PREFIX = "sculptures-v2/v4.2.1-20261110"
CACHE = "public, max-age=31536000, immutable"

def check(condition, message):
    if not condition:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def file_hash(path):
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for piece in iter(lambda: fp.read(1048576), b""):
            h.update(piece)
    return h.hexdigest()

def add_asset(entries, path, label, suffix, expected=None, content_type="application/gzip"):
    check(path.is_file(), "Missing audited V2 asset: " + label)
    checksum = file_hash(path)
    check(expected is None or expected == checksum,
          "Audited source hash mismatch: " + label)
    check(re.fullmatch(r"[a-f0-9]{64}", checksum) is not None,
          "Invalid SHA-256")
    key = PREFIX + "/" + label + "/" + checksum + suffix
    check(key.startswith(PREFIX + "/") and ".." not in key and len(key) < 270,
          "Unsafe R2 key")
    entry = {"path": str(path), "key": key, "sha256": checksum,
             "bytes": path.stat().st_size, "contentType": content_type,
             "url": WORKER + "/" + key, "label": label}
    entries.append(entry)
    return {k: entry[k] for k in ("sha256", "bytes", "url")}

def make_catalog(history, reception):
    report = json.loads((history / "bake-report.json").read_text())
    check(report["schema"] == "pp-sculpture-v2-bake-report" and
          report["mode"] == "historical" and
          report["failed"] == 0 and
          report["sourceDateCount"] == 37 and
          report["attempted"] == 534 and
          report["qualityVariants"] == ["desktop", "mobile"] and
          len(report["days"]) == 37,
          "Historical V2 artifact is not approved full bake")
    entries = []
    catalog = {"schema": "pp-sculpture-v2-r2-catalog", "version": 1,
               "release": "v4.2.1-20261110",
               "geometryRevision": "v4.2.1-v2-pigment-island-fix",
               "bucket": BUCKET, "worker": WORKER,
               "sourceRuns": {"historical": 42904867052,
                              "reception": 42915426552},
               "days": {}, "reception": {}}
    portrait_total = 0
    for day in report["days"]:
        date = day["date"]
        count = day["eligible"]
        check(re.fullmatch(r"20\d\d-\d\d-\d\d", date) is not None and
              date <= "2026-11-10" and date not in catalog["days"],
              "Archive date changed")
        check(isinstance(count, int) and count >= 0, "Invalid portrait count")
        portrait_total += count
        catalog["days"][date] = {"portraits": count, "qualities": {}}
        if not count:
            continue
        check(day["baked"] == count, "Incomplete historical floor")
        base = history / date / "3d" / "v2"
        meta = json.loads((base / "manifest.json").read_text())
        check(meta["schema"] == "pp-sculpture-v2-floor-manifest" and
              meta["version"] == 2 and meta["date"] == date and
              meta["expectedPortraits"] == count and not meta["samplesOnly"] and
              set(meta["qualities"]) == {"desktop", "mobile"},
              "Incomplete historical manifest")
        for quality in ("desktop", "mobile"):
            m = meta["qualities"][quality]
            check(m["complete"] and m["bakedPortraits"] == count and
                  m["file"] == "sculptures." + quality + ".json.gz",
                  "Incomplete quality pack")
            p = base / m["file"]
            check(p.stat().st_size == m["byteLength"] and
                  1000 < p.stat().st_size < 45 * 1024 * 1024,
                  "Invalid original floor pack byte size")
            details = add_asset(entries, p, "floors/" + date + "/" + quality,
                                ".json.gz", m["sha256"])
            details["portraits"] = count
            catalog["days"][date]["qualities"][quality] = details
    check(portrait_total == 267 and len(entries) == 66,
          "Expected 267 historical portraits and 66 quality packs")
    source = json.loads((reception / "source.json").read_text())
    meta = json.loads((reception / "manifest.json").read_text())
    png = reception / "recursive-divisions-portrait.png"
    check(source["schema"] == "pp-v2-reception-portrait-source" and
          source["orientation"] == "portrait" and
          source["width"] == 1000 and source["height"] == 1400 and
          source["seed"] == "PP-RECEPTION-RECTS-P-20261110" and
          source["engine"] == "rects" and
          meta["sourceSha256"] == source["sourceSha256"] and
          meta["orientation"] == "portrait",
          "Reception pairing or identity changed")
    raw = png.read_bytes()
    check(raw[:8] == b"\x89PNG\r\n\x1a\n" and
          int.from_bytes(raw[16:20], "big") == 1000 and
          int.from_bytes(raw[20:24], "big") == 1400,
          "Reception original must be 1000 x 1400 portrait")
    catalog["reception"]["image"] = add_asset(entries, png, "reception/image",
                                              ".png", source["sourceSha256"],
                                              "image/png")
    for name in ("source", "manifest"):
        catalog["reception"][name] = add_asset(
            entries, reception / (name + ".json"), "reception/" + name,
            ".json", content_type="application/json")
    for quality in ("desktop", "mobile"):
        m = meta["quality"][quality]
        check(m["complete"] and m["file"] == "sculptures." + quality + ".json.gz",
              "Incomplete reception geometry")
        catalog["reception"][quality] = add_asset(
            entries, reception / m["file"], "reception/" + quality,
            ".json.gz", m["sha256"])
    check(len(entries) == 71, "Missing audited archive or reception assets")
    packed = (json.dumps(catalog, sort_keys=True,
                         separators=(",", ":")) + "\n").encode()
    catalog_path = history / "r2-v2-catalog.json"
    catalog_path.write_bytes(packed)
    catalog["catalog"] = add_asset(entries, catalog_path, "catalog", ".json",
                                   sha(packed), "application/json")
    return entries, catalog

def connect():
    import boto3
    from botocore.config import Config
    check(os.environ.get("GITHUB_REPOSITORY") == "southernadd-cmyk/algoart" and
          os.environ.get("GITHUB_REF") == "refs/heads/main" and
          os.environ.get("GITHUB_EVENT_NAME") == "push",
          "R2 upload restricted to verified main push workflow")
    account = os.environ["R2_ACCOUNT_ID"]
    key = os.environ["R2_MEDIA_ACCESS_KEY_ID"]
    secret = os.environ["R2_MEDIA_SECRET_ACCESS_KEY"]
    check(re.fullmatch("[a-fA-F0-9]{32}", account) is not None and
          len(key) > 8 and len(secret) > 8, "Existing R2 credentials unavailable")
    return boto3.client("s3",
        endpoint_url="https://" + account + ".r2.cloudflarestorage.com",
        aws_access_key_id=key, aws_secret_access_key=secret, region_name="auto",
        config=Config(signature_version="s3v4", connect_timeout=15,
                      read_timeout=60, request_checksum_calculation="when_required",
                      response_checksum_validation="when_required",
                      s3={"addressing_style": "path"}))

def persist(client, entry):
    from botocore.exceptions import ClientError
    with Path(entry["path"]).open("rb") as fp:
        try:
            client.put_object(Bucket=BUCKET, Key=entry["key"], Body=fp,
                ContentLength=entry["bytes"],
                ContentType=entry["contentType"], CacheControl=CACHE,
                Metadata={"sha256": entry["sha256"]}, IfNoneMatch="*")
        except ClientError as error:
            if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
                raise
    head = client.head_object(Bucket=BUCKET, Key=entry["key"])
    check(head["ContentLength"] == entry["bytes"] and
          head["ContentType"] == entry["contentType"] and
          head.get("Metadata", {}).get("sha256") == entry["sha256"],
          "R2 key collision or incomplete upload: " + entry["key"])
    response = client.get_object(Bucket=BUCKET, Key=entry["key"])
    h = hashlib.sha256()
    length = 0
    try:
        for chunk in response["Body"].iter_chunks(chunk_size=1048576):
            if chunk:
                length += len(chunk)
                h.update(chunk)
    finally:
        response["Body"].close()
    check(length == entry["bytes"] and h.hexdigest() == entry["sha256"],
          "Stored bytes did not match SHA-256: " + entry["key"])

def verify_public(entry):
    for method in ("GET", "HEAD"):
        request = Request(entry["url"], method=method,
                          headers={"Origin": ORIGIN})
        with urlopen(request, timeout=90) as response:
            headers = response.headers
            check(response.status == 200 and
                  headers.get("Content-Type") == entry["contentType"] and
                  headers.get("Access-Control-Allow-Origin") == ORIGIN and
                  int(headers.get("Content-Length", "0")) == entry["bytes"],
                  "R2 Worker/CORS is not serving V2 asset: " + entry["key"])
            if method == "GET":
                check(sha(response.read(entry["bytes"] + 1)) == entry["sha256"],
                      "R2 Worker public bytes differ: " + entry["key"])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("historical", type=Path)
    parser.add_argument("reception", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    entries, catalog = make_catalog(args.historical, args.reception)
    if not args.dry_run:
        client = connect()
        client.head_bucket(Bucket=BUCKET)
        for i, entry in enumerate(entries, 1):
            persist(client, entry)
            print("V2_R2_OBJECT_OK " + json.dumps({
                "number": i, "total": len(entries), "name": entry["label"],
                "bytes": entry["bytes"]}), flush=True)
        sample_names = {"catalog", "floors/2026-11-10/desktop",
                        "floors/2026-10-22/mobile",
                        "reception/image", "reception/mobile"}
        for entry in entries:
            if entry["label"] in sample_names:
                verify_public(entry)
        print("V2_R2_PUBLIC_OK " + json.dumps({
            "samples": len(sample_names), "catalog": catalog["catalog"]["url"]}))
    print("V2_R2_ARCHIVE_COMPLETE " + json.dumps({
        "dryRun": args.dry_run, "objects": len(entries),
        "historicDates": len(catalog["days"]), "models": 534,
        "bytes": sum(a["bytes"] for a in entries),
        "catalog": catalog["catalog"]["url"]}), flush=True)

if __name__ == "__main__":
    main()
