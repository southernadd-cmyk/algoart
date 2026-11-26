#!/usr/bin/env python3
"""GS2: immutable splat publication; never writes mesh or artwork keys."""
import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
import math
import struct
import os
import re
from datetime import date
from pathlib import Path

BUCKET = "proportion-piece-media-test"
WORKER = "https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev"
PREFIX = "sculptures-splats/v1/assembly-20261117"
REVISION = "v4.2.1-v2-pigment-island-fix"
ALGORITHM = "v2-surface-uv-diffuse-v1"
BUDGETS = {"mobile": 12000, "desktop": 30000}
MAX_PACK = 45 * 1048576
HASH = re.compile(r"[a-f0-9]{64}")
# Reuse the archive uploader's create-only S3 operations and public CORS checks.
_spec = importlib.util.spec_from_file_location("v2_storage", Path(__file__).with_name("upload-sculpture-v2-r2.py"))
_storage = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_storage)

def require(ok, message):
    if not ok:
        raise ValueError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def valid_day(day):
    if day == "reception":
        return True
    try:
        return re.fullmatch(r"20\d{2}-\d{2}-\d{2}", day) and date.fromisoformat(day).isoformat() == day
    except (ValueError, TypeError):
        return False

def entry(path, key, kind, label):
    require(key.startswith(PREFIX + "/"), "Unexpected R2 prefix")
    return {"path": str(path), "key": key, "sha256": digest(path.read_bytes()),
            "bytes": path.stat().st_size, "contentType": kind,
            "url": WORKER + "/" + key, "label": label}

def prepare(day, folder):
    require(valid_day(day), "Invalid edition")
    objects, qualities, roster = [], {}, None
    for quality, budget in BUDGETS.items():
        matches = list(folder.glob(day + "-" + quality + "-*.json.gz"))
        require(len(matches) == 1, "Exactly one staged pack required: " + quality)
        path = matches[0]
        data = path.read_bytes()
        sha = digest(data)
        require(path.name == f"{day}-{quality}-{sha}.json.gz" and 0 < len(data) <= MAX_PACK,
                "Invalid content-addressed pack " + quality)
        with gzip.open(path, "rb") as stream:
            raw = stream.read(128 * 1048576 + 1)
        require(len(raw) <= 128 * 1048576, "Oversized decoded splat pack")
        pack = json.loads(raw)
        require(pack.get("schema") == "pp-sculpture-splats" and pack.get("version") == 1
                and pack.get("algorithm") == ALGORITHM and pack.get("geometryRevision") == REVISION
                and pack.get("date") == day and pack.get("quality") == quality
                and pack.get("stride") == 11 and pack.get("encoding") == "f32le-base64"
                and HASH.fullmatch(pack.get("sourceSha256", "")), "Invalid pack identity")
        studies = pack.get("studies", {})
        require(isinstance(studies, dict) and 0 < len(studies) == pack.get("expectedPortraits"), "Incomplete roster")
        current = {}
        for name, study in studies.items():
            require(study.get("imageFile") == name and isinstance(study.get("seed"), str)
                    and study["seed"] and HASH.fullmatch(study.get("sourceGeometrySha256", ""))
                    and study.get("pointCount") == budget, "Invalid source identity or point count")
            points = base64.b64decode(study["points"], validate=True)
            require(len(points) == budget * 44 and digest(points) == study.get("pointsSha256"),
                    "Corrupt splat records: " + name)
            meshes = study.get("meshCounts", [])
            materials = study.get("materialCounts", [])
            require(isinstance(meshes, list) and meshes and isinstance(materials, list)
                    and len(meshes) == len(materials)
                    and all(isinstance(m, list) and len(m) == 2
                            and all(type(n) is int and n > 0 for n in m)
                            and m[1] % 3 == 0 for m in meshes)
                    and all(type(n) is int and n > 0 for n in materials)
                    and sum(m[1] // 3 for m in meshes) == study.get("originalTriangles"),
                    "Invalid source geometry counts")
            coverage = [0] * len(meshes)
            for point in struct.iter_unpack("<11f", points):
                nx, ny, nz = point[3:6]
                radius, mesh, material = point[8:11]
                require(all(math.isfinite(n) for n in point)
                        and abs(nx*nx + ny*ny + nz*nz - 1) <= 1e-4 and radius > 0
                        and mesh.is_integer() and 0 <= mesh < len(meshes)
                        and material.is_integer() and 0 <= material < materials[int(mesh)],
                        "Invalid splat record")
                coverage[int(mesh)] += 1
            require(all(n >= 4 for n in coverage), "Missing pigment region")
            current[name] = study["seed"]
        require(roster is None or roster == current, "Quality tiers disagree on sculpture identity")
        roster = current
        item = entry(path, f"{PREFIX}/{day}/{quality}/{sha}.json.gz", "application/gzip", quality)
        objects.append(item)
        qualities[quality] = {k: item[k] for k in ("sha256", "bytes", "url")}
        qualities[quality].update(sourceSha256=pack["sourceSha256"], pointsPerStudy=budget)
    manifest = {"schema": "pp-sculpture-splats-r2-manifest", "version": 1,
                "algorithm": ALGORITHM, "geometryRevision": REVISION, "date": day,
                "presetId": "assembly-100-100-40-95", "worker": WORKER,
                "ready": True, "portraits": len(roster), "studies": roster, "qualities": qualities}
    path = folder / "manifest.json"
    path.write_text(json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n")
    objects.append(entry(path, f"{PREFIX}/{day}/manifest.json", "application/json", "manifest"))
    return manifest, objects

def publish(client, objects, persist=_storage.persist, verify_public=_storage.verify_public):
    # A conflicting immutable manifest must fail before uploading orphan packs.
    from botocore.exceptions import ClientError
    pointer = objects[-1]
    try:
        head = client.head_object(Bucket=BUCKET, Key=pointer["key"])
    except ClientError as error:
        if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
            raise
    else:
        require(head.get("Metadata", {}).get("sha256") == pointer["sha256"],
                "Existing splat manifest differs; use a new version, never overwrite")
        # Existing publication: read back all three, not merely the pointer.
        for item in objects:
            response = client.get_object(Bucket=BUCKET, Key=item["key"])
            try:
                data = response["Body"].read()
            finally:
                response["Body"].close()
            require(len(data) == item["bytes"] and digest(data) == item["sha256"], "Existing splat object corrupt")
            verify_public(item)
        return
    # Packs must be accessible through the real read-only gateway before announcing readiness.
    for item in objects:
        persist(client, item)
        verify_public(item)

def connect():
    import boto3
    from botocore.config import Config
    require(os.environ.get("GITHUB_REPOSITORY") == "southernadd-cmyk/algoart"
            and os.environ.get("GITHUB_REF") == "refs/heads/main"
            and os.environ.get("GITHUB_EVENT_NAME") in ("workflow_dispatch", "workflow_run", "schedule", "push")
            and os.environ.get("SPLAT_PUBLICATION_ARMED") == "true", "Splat publication requires trusted main workflow")
    if os.environ.get("GITHUB_EVENT_NAME") == "push":
        require(os.environ.get("SPLAT_ARCHIVE_BACKFILL") == "true", "Push publication is restricted to archive backfill")
    account = os.environ["R2_ACCOUNT_ID"]
    require(re.fullmatch(r"[a-fA-F0-9]{32}", account), "Invalid R2 account")
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_MEDIA_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_MEDIA_SECRET_ACCESS_KEY"],
        region_name="auto", config=Config(signature_version="s3v4", connect_timeout=15,
        read_timeout=90, request_checksum_calculation="when_required",
        response_checksum_validation="when_required", s3={"addressing_style": "path"}))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--source-mobile-sha")
    parser.add_argument("--source-desktop-sha")
    args = parser.parse_args()
    manifest, objects = prepare(args.date, args.out)
    if args.source_mobile_sha is not None or args.source_desktop_sha is not None:
        for quality, expected in (("mobile", args.source_mobile_sha), ("desktop", args.source_desktop_sha)):
            require(expected and HASH.fullmatch(expected) and manifest["qualities"][quality]["sourceSha256"] == expected,
                    "Staged pack does not match expected V2 source: " + quality)
    if not args.dry_run:
        client = connect()
        client.head_bucket(Bucket=BUCKET)
        publish(client, objects)
    print("GS2_SPLAT_PUBLICATION " + json.dumps({"date": args.date, "dryRun": args.dry_run,
        "portraits": manifest["portraits"], "objects": len(objects),
        "bytes": sum(x["bytes"] for x in objects), "manifest": objects[-1]["url"]}), flush=True)

if __name__ == "__main__":
    main()
