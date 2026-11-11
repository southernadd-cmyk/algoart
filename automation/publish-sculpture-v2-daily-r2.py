#!/usr/bin/env python3
"""Publish source-verified daily Sculpture V2 packs after the gallery archive is committed.

Never updates gallery/ or V1. Writes only immutable R2 keys in a disjoint
namespace. Repeated publication is allowed only for byte-identical data.
"""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
from datetime import date

BUCKET = "proportion-piece-media-test"
WORKER = "https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev"
PREFIX = "sculptures-v2/daily/v4.2.1"
REVISION = "v4.2.1-v2-pigment-island-fix"

def require(ok, message):
    if not ok:
        raise ValueError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def add(objects, key, data, media_type, identity):
    require(key.startswith(PREFIX + "/") and ".." not in key,
            "Unapproved daily R2 key " + key)
    item = {"key": key, "data": data, "bytes": len(data),
            "sha256": digest(data), "type": media_type,
            "url": WORKER + "/" + key, "identity": identity}
    objects.append(item)
    return {k: item[k] for k in ("sha256", "bytes", "url")}

def prepare(day, root, gallery):
    require(re.fullmatch(r"20\d{2}-\d{2}-\d{2}", day) is not None and
            "2026-11-11" <= day <= date.today().isoformat(),
            "Only post-archive daily dates are permitted")
    meta_path = gallery / day / "meta.json"
    require(meta_path.is_file(), "Published gallery metadata required before V2")
    meta_bytes = meta_path.read_bytes()
    meta = json.loads(meta_bytes)
    require(meta.get("date") == day,"Gallery date mismatch")
    solo = [e for e in meta["entries"] if e.get("orientation") == "portrait"
            and e.get("material") != "confluence"]
    require(len(solo) > 0,"No eligible solo portraits for daily V2")
    require(len(set(e["imageFile"] for e in solo)) == len(solo),
            "Duplicate source painting identifiers")
    require(all((gallery / day / e["imageFile"]).is_file() for e in solo),
            "Published solo painting missing")
    report = json.loads((root / "bake-report.json").read_text())
    require(report.get("schema") == "pp-sculpture-v2-bake-report" and
            report.get("mode") == "single-day" and
            report.get("failed") == 0 and
            report.get("sourceDateCount") == 1 and
            report.get("qualityVariants") == ["desktop","mobile"] and
            report.get("attempted") == 2*len(solo) and
            len(report.get("days",[])) == 1 and
            report["days"][0]["date"] == day and
            report["days"][0]["eligible"] == len(solo) and
            report["days"][0]["baked"] == len(solo),
            "Daily V2 geometry bake is not complete")
    folder = root / day / "3d" / "v2"
    recorded = json.loads((folder / "manifest.json").read_text())
    require(recorded.get("schema") == "pp-sculpture-v2-floor-manifest" and
            recorded.get("revision") == REVISION and
            recorded.get("date") == day and
            recorded.get("expectedPortraits") == len(solo) and
            recorded.get("samplesOnly") is False and
            set(recorded["qualities"]) == {"desktop","mobile"},
            "Daily V2 quality manifest is incomplete")
    assets = {}
    objects = []
    for quality in ("desktop","mobile"):
        item = recorded["qualities"][quality]
        require(item["complete"] and item["bakedPortraits"] == len(solo) and
                item["file"] == "sculptures." + quality + ".json.gz",
                "Daily quality missing " + quality)
        file = folder / item["file"]
        compressed = file.read_bytes()
        require(1000 < len(compressed) < 45 * 1048576 and
                len(compressed) == item["byteLength"] and
                digest(compressed) == item["sha256"],
                "Corrupt daily quality bytes " + quality)
        pack = json.loads(gzip.decompress(compressed))
        require(pack.get("schema") == "pp-sculpture-v2-floor" and
                pack.get("version") == 2 and pack.get("date") == day and
                pack.get("quality") == quality and
                pack.get("method") == "assembly" and
                pack.get("geometryRevision") == REVISION and
                pack.get("complete") and
                pack.get("expectedPortraits") == len(solo) and
                pack.get("bakedPortraits") == len(solo) and
                set(pack["studies"]) == {e["imageFile"] for e in solo},
                "Incomplete, unapproved daily V2 pack " + quality)
        for study in pack["studies"].values():
            src = gallery / day / study["sourceFile"]
            require(src.is_file() and
                    digest(src.read_bytes()) == study["sourceSha256"] and
                    study["coverage"] == 1 and study["omittedCells"] == 0 and
                    study["geometryRevision"] == REVISION and
                    study["quality"] == quality,
                    "V2 has lost its originating painting")
        key = f"{PREFIX}/{day}/{quality}/{digest(compressed)}.json.gz"
        assets[quality] = add(objects, key, compressed,"application/gzip",quality)
    daily_manifest = {
        "schema": "pp-sculpture-v2-daily-r2-manifest", "version": 1,
        "revision": REVISION, "date": day, "portraits": len(solo),
        "metaSha256": digest(meta_bytes),
        "qualities": assets, "worker": WORKER,
        "ready": True, "confluenceExcluded": True
    }
    manifest_bytes = (json.dumps(daily_manifest,sort_keys=True,
                          separators=(",",":"))+"\n").encode()
    # Stable date-scoped publication pointer, immutable after first publish.
    add(objects, f"{PREFIX}/{day}/manifest.json",
        manifest_bytes,"application/json","manifest")
    require(len(objects) == 3,"Daily R2 output must be exactly 3 objects")
    return daily_manifest,objects

def put_verified(client,item):
    from botocore.exceptions import ClientError
    from io import BytesIO
    try:
        client.put_object(Bucket=BUCKET,Key=item["key"],
            Body=BytesIO(item["data"]), ContentLength=item["bytes"],
            ContentType=item["type"],
            CacheControl="public, max-age=31536000, immutable",
            Metadata={"sha256":item["sha256"]},IfNoneMatch="*")
    except ClientError as e:
        if e.response.get("ResponseMetadata",{}).get("HTTPStatusCode") != 412:
            raise
    head=client.head_object(Bucket=BUCKET,Key=item["key"])
    require(head["ContentLength"] == item["bytes"] and
            head.get("Metadata",{}).get("sha256") == item["sha256"],
            "R2 daily object collision: " + item["identity"])
    response=client.get_object(Bucket=BUCKET,Key=item["key"])
    try:
        original=response["Body"].read()
    finally:
        response["Body"].close()
    require(len(original) == item["bytes"] and
            digest(original) == item["sha256"],
            "R2 stored daily bytes differ: " + item["identity"])

def connect():
    import boto3
    from botocore.config import Config
    event = os.environ.get("GITHUB_EVENT_NAME")
    recovery = (event == "workflow_dispatch" and
                os.environ.get("V2_RECOVERY_DATE") == "2026-11-11" and
                os.environ.get("V2_PUBLISH_DATE") == "2026-11-11")
    art_only = (event == "workflow_dispatch" and
                os.environ.get("R2_ART_ONLY") == "true" and
                os.environ.get("V2_PUBLISH_DATE") == os.environ.get("PP_R2_ART_ONLY_DATE") and
                bool(os.environ.get("PP_R2_ART_ONLY_DATE")) and
                os.environ.get("PP_R2_ART_ONLY_SOCIAL_READY") == "true")
    require(os.environ.get("GITHUB_REPOSITORY") == "southernadd-cmyk/algoart" and
            os.environ.get("GITHUB_REF") == "refs/heads/main" and
            (event == "workflow_run" or recovery or art_only),
            "Only successful upstream gallery runs or explicitly armed manual editions may publish V2")
    account = os.environ["R2_ACCOUNT_ID"]
    require(re.fullmatch(r"[a-fA-F0-9]{32}",account) is not None,
            "Invalid existing Cloudflare R2 account")
    return boto3.client("s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_MEDIA_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_MEDIA_SECRET_ACCESS_KEY"],
        region_name="auto",config=Config(signature_version="s3v4",
            connect_timeout=15,read_timeout=90,
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
            s3={"addressing_style":"path"}))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--date",required=True)
    p.add_argument("--out",type=Path,required=True)
    p.add_argument("--gallery",type=Path,default=Path("gallery"))
    p.add_argument("--dry-run",action="store_true")
    args=p.parse_args()
    manifest,objects=prepare(args.date,args.out,args.gallery)
    if not args.dry_run:
        client=connect()
        client.head_bucket(Bucket=BUCKET)
        # Manifest last. No incomplete day is ever announced as ready.
        for item in objects:
            put_verified(client,item)
            print("V2_DAILY_R2_OBJECT_OK "+json.dumps({
                "date":args.date,"name":item["identity"],"bytes":item["bytes"]}),
                flush=True)
    print("V2_DAILY_R2_COMPLETE "+json.dumps({
        "date":args.date,"dryRun":args.dry_run,
        "qualities":list(manifest["qualities"]),"portraits":manifest["portraits"],
        "objects":len(objects),"v1Untouched":True,
        "manifest":objects[-1]["url"]}),flush=True)

if __name__=="__main__":
    main()
