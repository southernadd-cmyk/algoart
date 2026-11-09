#!/usr/bin/env python3
"""Read-only-site rehearsal of a future daily R2 publication.

Commands:
  stage    Upload/HEAD only manifest-listed SHA-addressed media to EXISTING
           proportion-piece-media-test; create cleanup receipts before PUT.
  verify   Public Worker GET/HEAD byte-for-byte verification of all media.
  cleanup  Delete ONLY run-owned R2 keys from the persisted receipt.
No operation edits any gallery page, GitHub branch or public URL.
This pre-release script deliberately has NO permanent-publication command.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

BUCKET="proportion-piece-media-test"
WORKER="https://proportion-piece-media.mr-adam-clement.workers.dev"
ORIGIN="https://southernadd-cmyk.github.io"
BRANCH="refs/heads/plan/archive-storage-foundation-20261109"
REPO="southernadd-cmyk/algoart"
DIR=Path(os.getenv("R2_STAGE_OUTPUT","/tmp/pp-r2-daily-stage"))
ROOT=Path(os.getenv("R2_STAGE_SOURCE","live-snapshot"))
MANIFEST=DIR/"media-publication.json"
RECEIPT=DIR/"created-media-keys.json"
RESULT=DIR/"upload-verification.json"

def sha(b):return hashlib.sha256(b).hexdigest()
def require(k):
    v=os.environ.get(k,"").strip()
    if not v: raise ValueError("Missing "+k)
    return v
def safety():
    assert require("GITHUB_REPOSITORY")==REPO
    assert require("GITHUB_REF")==BRANCH
    assert require("GITHUB_EVENT_NAME")=="push"
    assert require("R2_MEDIA_BUCKET")==BUCKET
    run=require("GITHUB_RUN_ID")
    assert re.fullmatch(r"\d{1,20}",run)
    assert DIR.is_absolute() and DIR.resolve()!=ROOT.resolve()
    assert not DIR.resolve().is_relative_to(ROOT.resolve())
    return run

def load():
    m=json.loads(MANIFEST.read_text("utf8"))
    if m.get("published") is not False or m.get("stageOnly") is not True:
        raise ValueError("Refuse non-staging publication manifest")
    if m.get("bucket")!=BUCKET or m.get("workerBase")!=WORKER:
        raise ValueError("Unexpected R2 target")
    date=m.get("date","")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",date) or date<"2026-11-09":
        raise ValueError("Invalid date")
    items=m.get("mediaAssets",[])
    if len(items)!=m.get("count",0)*3+2 or len(items)<8 or len(items)>100:
        raise ValueError("Incomplete media asset inventory")
    keys=set()
    pattern=re.compile(
        rf"^editions/{re.escape(date)}/(?:[\w-]+/(?:original|mobile|desktop)-[a-f0-9]{{64}}\.(?:jpg|jpeg|webp)|(?:cover-[a-f0-9]{{64}}\.jpg|sculptures-[a-f0-9]{{64}}\.json\.gz))$")
    for x in items:
        key=x.get("key","")
        if not pattern.fullmatch(key) or key in keys:
            raise ValueError("Unsafe or duplicate R2 media key")
        keys.add(key)
        if x.get("url")!=WORKER+"/"+key or x.get("bytes",0)<1000:
            raise ValueError("Unsafe media URI or size")
        source=x.get("sourcePath","")
        if not re.fullmatch(r"gallery/"+date+r"/(?:3d/)?[\w.-]+",source) or ".." in source:
            raise ValueError("Unsafe original media path")
        data=(ROOT/source).read_bytes()
        if sha(data)!=x.get("sha256") or len(data)!=x.get("bytes"):
            raise ValueError("Changed published original file "+source)
        if x.get("contentType") not in ("image/jpeg","image/webp","application/gzip"):
            raise ValueError("Unexpected Content-Type")
        if not key.endswith(x["sha256"]+"."+("json.gz" if x["contentType"]=="application/gzip"
                                   else "webp" if x["contentType"]=="image/webp" else "jpg")):
            raise ValueError("Media key must be content-addressed")
    return m, items

def s3():
    import boto3
    from botocore.config import Config
    account=require("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[a-fA-F0-9]{32}",account):raise ValueError("Invalid Cloudflare account")
    return boto3.client("s3",endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
     aws_access_key_id=require("R2_MEDIA_ACCESS_KEY_ID"),
     aws_secret_access_key=require("R2_MEDIA_SECRET_ACCESS_KEY"),
     region_name="auto",config=Config(signature_version="s3v4",read_timeout=40,
        connect_timeout=15,retries={"max_attempts":2},s3={"addressing_style":"path"}))

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+".tmp")
    tmp.write_text(json.dumps(data,indent=2))
    tmp.replace(path)

def receipt(m,run):
    if not RECEIPT.exists():
        return {"run":run,"date":m["date"],"bucket":BUCKET,"createdKeys":[]}
    obj=json.loads(RECEIPT.read_text())
    if obj.get("bucket")!=BUCKET or obj.get("run")!=run or obj.get("date")!=m["date"]:
        raise ValueError("Receipt belongs to another run")
    permitted={x["key"] for x in m["mediaAssets"]}
    if len(set(obj.get("createdKeys",[])))!=len(obj.get("createdKeys",[])) or not set(obj.get("createdKeys",[])).issubset(permitted):
        raise ValueError("Refuse unknown cleanup keys")
    return obj

def r2_head(c,item):
    from botocore.exceptions import ClientError
    try:
        h=c.head_object(Bucket=BUCKET,Key=item["key"])
    except ClientError as ex:
        if ex.response.get("ResponseMetadata",{}).get("HTTPStatusCode")==404:
            return None
        raise
    return h

def stage(m,items,run):
    c=s3()
    c.head_bucket(Bucket=BUCKET)
    r=receipt(m,run)
    if r["createdKeys"]: raise ValueError("Already staged; run verify or cleanup")
    created=0
    for a in items:
        data=(ROOT/a["sourcePath"]).read_bytes()
        prior=r2_head(c,a)
        if prior is not None:
            if prior.get("ContentLength")!=len(data) or prior.get("Metadata",{}).get("sha256")!=a["sha256"]:
                raise ValueError("Existing R2 key has incorrect content: refuse overwrite")
            continue   # Do not delete previously stored copies.
        # Record upload INTENT before put_object so cleanup works after failure.
        r["createdKeys"].append(a["key"])
        write(RECEIPT,r)
        c.put_object(Bucket=BUCKET,Key=a["key"],Body=data,
          ContentType=a["contentType"],
          CacheControl="public, max-age=31536000, immutable",
          Metadata={"sha256":a["sha256"]})
        h=r2_head(c,a)
        if not h or h["ContentLength"]!=a["bytes"] or h.get("Metadata",{}).get("sha256")!=a["sha256"] or not h.get("ContentType","").startswith(a["contentType"]):
            raise ValueError("R2 HEAD upload integrity failure "+a["sourcePath"])
        created+=1
    print(f"R2 STAGE PASS: {len(items)}/{len(items)} originals and derivatives; {created} new, {len(items)-created} already hash-verified.")

def verify(m,items):
    import requests
    s=requests.Session()
    counts={"media":len(items),"jpeg":0,"webp":0,"gzip":0}
    cf_headers=[]
    for a in items:
        r=s.get(a["url"],headers={"Origin":ORIGIN},allow_redirects=False,timeout=(15,55))
        if r.status_code!=200 or len(r.content)!=a["bytes"] or sha(r.content)!=a["sha256"]:
            raise ValueError(f"Worker GET failed public hash: {a['sourcePath']}: HTTP {r.status_code}")
        if not r.headers.get("Content-Type","").startswith(a["contentType"]):
            raise ValueError("Worker content type mismatch "+a["sourcePath"])
        if r.headers.get("Access-Control-Allow-Origin")!=ORIGIN:
            raise ValueError("CORS mismatch "+a["sourcePath"])
        h=s.head(a["url"],headers={"Origin":ORIGIN},allow_redirects=False,timeout=30)
        if h.status_code!=200 or int(h.headers.get("Content-Length","0"))!=a["bytes"]:
            raise ValueError("Worker HEAD failure "+a["sourcePath"])
        if not h.headers.get("Content-Type","").startswith(a["contentType"]):
            raise ValueError("Worker HEAD Content-Type "+a["sourcePath"])
        mime=a["contentType"]
        counts["jpeg" if mime=="image/jpeg" else "webp" if mime=="image/webp" else "gzip"]+=1
        if r.headers.get("CF-Cache-Status"):cf_headers.append(r.headers["CF-Cache-Status"])
    summary={"passed":True,"worker":WORKER,"date":m["date"],
      "sourceCount":m["count"],"objectsVerified":len(items),"kinds":counts,
      "allSha256Matched":True,"exactCORSPassed":True,"allHeadPassed":True,
      "cfCacheStatusesObserved":cf_headers,
      "noPublicationOrDeletionOfHistoricPages":True}
    write(RESULT,summary)
    print("WORKER DELIVERY PASS: "+str(len(items))+"/"+str(len(items))+" GET+HEAD MIME/CORS/SHA256.")
    return summary

def cleanup(m,run):
    r=receipt(m,run)
    if not r["createdKeys"]:
        print("CLEANUP PASS: no new keys; no delete")
        return
    c=s3()
    errors=[]
    for key in r["createdKeys"]:
        try:
            c.delete_object(Bucket=BUCKET,Key=key)
            if r2_head(c,{"key":key}) is not None:
                raise ValueError("Object survived delete")
        except Exception as e:errors.append((key,str(e)))
    if errors:raise ValueError("Cleanup failures for "+str(len(errors))+" keys (receipt preserved)")
    print("CLEANUP PASS: "+str(len(r["createdKeys"]))+" run-created media objects removed; preexisting R2 objects untouched")

if __name__=="__main__":
    run=safety()
    m,items=load()
    command=sys.argv[1] if len(sys.argv)>1 else ""
    if command=="stage":stage(m,items,run)
    elif command=="verify":verify(m,items)
    elif command=="cleanup":cleanup(m,run)
    else:raise SystemExit("Usage: upload-r2-daily-rehearsal.py stage|verify|cleanup")
