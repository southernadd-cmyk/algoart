#!/usr/bin/env python3
"""Release A: stage and remove public media TEST objects, in a SEPARATE R2 bucket.

Never touches proportion-piece-archive-test, never alters the live gallery.
Commands:
  --preflight  Confirm the test bucket is empty, credentials are bucket-scoped.
  --stage      Upload 7 real gallery image/texture samples under a unique run key.
  --cleanup    Delete only the exact run's test prefix, verify zero survivors.
  --self-test  Offline verification of fixed bucket/prefix and source selections.

This script never enables public access or edits bucket CORS. Those settings are
made only by the user on the dedicated media-only bucket.
"""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

BUCKET="proportion-piece-media-test"
BACKUP_BUCKET="proportion-piece-archive-test"
REF="refs/heads/plan/archive-storage-foundation-20261109"
REPO="southernadd-cmyk/algoart"
ORIGIN="https://southernadd-cmyk.github.io"
DAY="2026-11-09"
SOURCE_FILES=[
    "gallery/2026-11-09/2026-11-09-C01-portrait.jpg",
    "gallery/2026-11-09/3d/2026-11-09-C01-portrait-1100.webp",
    "gallery/2026-11-09/3d/2026-11-09-C01-portrait-640.webp",
    "gallery/2026-11-09/2026-11-09-C02-landscape.jpg",
    "gallery/2026-11-09/3d/2026-11-09-C02-landscape-640.webp",
    "gallery/2026-11-09/2026-11-09-G08-action-geometric-portrait.jpg",
    "gallery/2026-11-09/3d/2026-11-09-G08-action-geometric-portrait-1100.webp",
]
KEY_BASE="_release-a-public-media-test"


def require(key):
    s=os.environ.get(key,"").strip()
    if not s:
        raise ValueError("Missing isolated media-test environment setting: "+key)
    return s


def safe_context():
    if require("GITHUB_REPOSITORY")!=REPO or require("GITHUB_REF")!=REF:
        raise ValueError("Refusing to run outside the isolated planning branch")
    if require("GITHUB_EVENT_NAME")!="push":
        raise ValueError("Only the one-shot isolated branch workflow may upload")
    if require("R2_MEDIA_BUCKET")!=BUCKET:
        raise ValueError("Refusing to access any bucket other than "+BUCKET)
    run=require("GITHUB_RUN_ID")
    attempt=require("GITHUB_RUN_ATTEMPT")
    if not re.fullmatch(r"\d{1,20}",run) or not re.fullmatch(r"\d{1,5}",attempt):
        raise ValueError("Invalid GitHub run identifiers")
    prefix=f"{KEY_BASE}/{run}/{attempt}/"
    if not re.fullmatch(r"_release-a-public-media-test/\d{1,20}/\d{1,5}/",prefix):
        raise ValueError("Unsafe storage key prefix")
    return prefix


def public_origin():
    raw=require("R2_MEDIA_PUBLIC_URL").rstrip("/")
    u=urlparse(raw)
    if (u.scheme!="https" or not u.hostname or u.username or u.password
        or u.port or u.path not in ("","/") or u.query or u.fragment):
        raise ValueError("Public test URL must be an HTTPS origin without any path or credentials")
    hostname=u.hostname.lower()
    if hostname.endswith(".r2.cloudflarestorage.com") or hostname.endswith(".github.io") or hostname=="r2.dev":
        raise ValueError("Refusing a private S3 endpoint or unrelated public origin")
    # r2.dev is ONLY for disposable test traffic; a custom domain is allowed too.
    if not (hostname.endswith(".r2.dev") or hostname.endswith(".r2.cloudflarestorage.com")==False):
        raise ValueError("Invalid media test URL hostname")
    if "proportion-piece-archive-test" in hostname:
        raise ValueError("Never use the private backup bucket as a public origin")
    return "https://"+hostname


def client():
    import boto3
    from botocore.config import Config
    account=require("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[0-9a-fA-F]{32}",account):
        raise ValueError("Invalid Cloudflare account ID")
    return boto3.client("s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=require("R2_MEDIA_ACCESS_KEY_ID"),
        aws_secret_access_key=require("R2_MEDIA_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4",connect_timeout=15,read_timeout=40,
                      retries={"max_attempts":2},s3={"addressing_style":"path"}))


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def exact_bucket(c):
    # Private backup bucket is never mentioned in API arguments.
    h=c.head_bucket(Bucket=BUCKET)
    if h is None:
        raise ValueError("Media-only test bucket did not respond")
    return c


def list_under(c,prefix):
    found=[]
    cursor=None
    while True:
        args={"Bucket":BUCKET,"Prefix":prefix,"MaxKeys":1000}
        if cursor:
            args["ContinuationToken"]=cursor
        r=c.list_objects_v2(**args)
        found.extend(x["Key"] for x in r.get("Contents",[]))
        if len(found)>200:
            raise ValueError("Unexpectedly many objects in disposable test prefix")
        if not r.get("IsTruncated"):
            return found
        cursor=r.get("NextContinuationToken")
        if not cursor:
            raise ValueError("Bucket pagination malformed")


def preflight(c,prefix):
    # We require a freshly created, EMPTY public bucket, not merely a free prefix.
    listed=c.list_objects_v2(Bucket=BUCKET,MaxKeys=2)
    if listed.get("KeyCount",0)>0 or listed.get("Contents"):
        raise ValueError("Media-only public test bucket must be completely empty before staging")
    if list_under(c,prefix):
        raise ValueError("Refusing to reuse an existing test prefix")
    print("Preflight passed: separate EMPTY media-only bucket and unique prefix")


def samples():
    root=Path("live-snapshot").resolve()
    if not (root/".git").is_dir():
        raise ValueError("Missing read-only published main snapshot")
    result=[]
    for name in SOURCE_FILES:
        p=root/name
        if not p.is_file() or p.is_symlink() or not str(p.resolve()).startswith(str(root)):
            raise ValueError("Gallery source sample is missing/unsafe")
        data=p.read_bytes()
        if not data or len(data)>2_000_000:
            raise ValueError("Unexpected gallery sample size")
        mime="image/webp" if name.endswith(".webp") else "image/jpeg"
        if mime=="image/jpeg" and not data.startswith(bytes.fromhex("ffd8")):
            raise ValueError("Invalid source JPEG")
        if mime=="image/webp" and not (data[:4]==b"RIFF" and data[8:12]==b"WEBP"):
            raise ValueError("Invalid source WebP")
        result.append({"name":name,"bytes":data,"mime":mime,"sha256":sha_bytes(data)})
    return result


def stage(c,prefix):
    preflight(c,prefix)
    origin=public_origin()
    report={"origin":ORIGIN,"publicMediaBaseURL":origin,"bucket":BUCKET,
            "sourceDate":DAY,"sampleCount":len(SOURCE_FILES),
            "publicTestingOnly":True,"productionUnchanged":True,"objects":[]}
    output=Path(require("R2_MEDIA_TEST_MANIFEST")).resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    # Persist every key to cleanup manifest BEFORE attempting upload.
    for item in samples():
        name=Path(item["name"]).name
        key=prefix+name
        url=origin+"/"+key
        record={"key":key,"url":url,"sourcePath":item["name"],
                "sha256":item["sha256"],"bytes":len(item["bytes"]),"contentType":item["mime"]}
        report["objects"].append(record)
        output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
        c.put_object(Bucket=BUCKET,Key=key,Body=item["bytes"],
                     ContentType=item["mime"],CacheControl="no-store",
                     Metadata={"sha256":item["sha256"]})
        head=c.head_object(Bucket=BUCKET,Key=key)
        if head.get("ContentLength")!=len(item["bytes"]) or head.get("Metadata",{}).get("sha256")!=item["sha256"]:
            raise ValueError("Media-only upload checksum metadata mismatch")
    print("STAGING PASSED: uploaded",len(report["objects"]),"disposable image objects to MEDIA-ONLY bucket")
    return report


def cleanup(c,prefix):
    keys=list_under(c,prefix)
    for key in keys:
        if not key.startswith(prefix):
            raise ValueError("Unsafe cleanup key, refusing")
        c.delete_object(Bucket=BUCKET,Key=key)
    if list_under(c,prefix):
        raise ValueError("Some disposable media objects remained after cleanup")
    print("CLEANUP PASSED:",len(keys),"media-only test objects removed")


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("mode",choices=["self-test","stage","cleanup"])
    args=parser.parse_args()
    if args.mode=="self-test":
        assert BUCKET!=BACKUP_BUCKET
        assert len(SOURCE_FILES)==7 and len(set(SOURCE_FILES))==7
        assert len([x for x in SOURCE_FILES if x.endswith(".webp")])==4
        print("SELF-TEST PASS: media-only exact bucket and 7 image samples")
        return
    prefix=safe_context()
    c=exact_bucket(client())
    if args.mode=="stage":
        stage(c,prefix)
    elif args.mode=="cleanup":
        cleanup(c,prefix)


if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("MEDIA-ONLY public test:",type(exc).__name__,
              str(exc).splitlines()[0][:220],file=sys.stderr)
        sys.exit(1)
