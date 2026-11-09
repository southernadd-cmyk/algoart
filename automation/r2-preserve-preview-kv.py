#!/usr/bin/env python3
"""Release A — preserve current Workers KV preview JPEGs without modifying KV.

Read-only Cloudflare Workers KV source -> immutable, private R2 test-bucket
backup -> downloaded archive -> byte-perfect restore rehearsal. Preserves exact
KV key names and source expiration/metadata in a PRIVATE archive. GitHub
Actions artifacts contain ONLY redacted hashes/counts and no JPEG bytes.

Not an independent-provider disaster-recovery backup. No public storage,
Worker deploy, production gallery mutation, KV put, or KV delete.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import tarfile
import tempfile
import time
import tomllib
from urllib.parse import quote
from datetime import datetime, timezone

SOURCE_REPO="southernadd-cmyk/algoart"
SOURCE_REF="refs/heads/plan/archive-storage-foundation-20261109"
BUCKET="proportion-piece-archive-test"
KV_PREFIX="previews/"
R2_PREFIX="_release-a-provisional-backup/cloudflare-kv/social-previews/"
MAX_ITEMS=5000
MAX_ITEM_BYTES=1_048_576
MAX_TOTAL_BYTES=1024*1024*1024


def required(name):
    v=os.environ.get(name,"").strip()
    if not v:
        raise ValueError("Missing "+name)
    return v


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hashfile(path):
    h=hashlib.sha256()
    n=0
    with open(path,"rb") as f:
        while chunk:=f.read(1_048_576):
            h.update(chunk)
            n+=len(chunk)
    return h.hexdigest(),n


def cf_session():
    import requests
    s=requests.Session()
    s.headers.update({"Authorization":"Bearer "+required("CF_KV_READ_TOKEN"),
                      "User-Agent":"proportion-piece-release-a-kv-preservation",
                      "Accept":"application/json"})
    return s


def cf_namespace():
    with open("cloudflare/social-preview/wrangler.toml","rb") as f:
        config=tomllib.load(f)
    match=[v for v in config.get("kv_namespaces",[]) if v.get("binding")=="PREVIEW_KV"]
    if len(match)!=1 or not re.fullmatch(r"[0-9a-fA-F]{32}",match[0].get("id","")):
        raise ValueError("Missing unique valid PREVIEW_KV binding")
    return match[0]["id"]


def cf_request(session,url,**kwargs):
    for attempt in range(4):
        response=session.get(url,timeout=(15,90),**kwargs)
        if response.status_code in (429,500,502,503,504) and attempt<3:
            response.close()
            time.sleep(2**attempt)
            continue
        response.raise_for_status()
        return response
    raise RuntimeError("Cloudflare API requests exhausted retries")


def get_keys(session,base):
    found=[]
    cursor=None
    cursors=set()
    for _ in range(100):
        params={"prefix":KV_PREFIX,"limit":1000}
        if cursor:
            params["cursor"]=cursor
        with cf_request(session,base+"/keys",params=params) as response:
            payload=response.json()
        if not payload.get("success") or not isinstance(payload.get("result"),list):
            raise ValueError("KV enumeration did not return successful list")
        for item in payload["result"]:
            name=item.get("name")
            if not isinstance(name,str) or not name.startswith(KV_PREFIX) or \
               not name.endswith(".jpg") or "/" in name[len(KV_PREFIX):] or len(name)>300:
                raise ValueError("Unexpected KV preview key outside allowed prefix")
            found.append({
                "name":name,
                "expiration":item.get("expiration"),
                "metadata":item.get("metadata"),
            })
        if len(found)>MAX_ITEMS:
            raise ValueError("KV preview count exceeded read-only safety limit")
        cursor=(payload.get("result_info") or {}).get("cursor")
        if not cursor:
            break
        if cursor in cursors:
            raise ValueError("Repeated KV pagination cursor")
        cursors.add(cursor)
    else:
        raise ValueError("KV preview enumeration exceeded pagination guard")
    if len({item["name"] for item in found})!=len(found):
        raise ValueError("Duplicate KV key in Cloudflare pagination")
    if not found:
        raise ValueError("No preview keys returned; refusing empty backup")
    return sorted(found,key=lambda a:a["name"])


def read_jpeg(session,base,key):
    url=base+"/values/"+quote(key,safe="")
    with cf_request(session,url,stream=True) as response:
        out=bytearray()
        for chunk in response.iter_content(131_072):
            if chunk:
                out.extend(chunk)
                if len(out)>MAX_ITEM_BYTES:
                    raise ValueError("KV preview exceeds maximum 1 MiB")
        data=bytes(out)
    if len(data)<4_000 or not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("KV image is not a complete JPEG")
    return data


def r2_client():
    import boto3
    from botocore.config import Config
    account=required("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[0-9a-fA-F]{32}",account):
        raise ValueError("Incorrect Cloudflare account-id format")
    return boto3.client(
        "s3",endpoint_url="https://"+account+".r2.cloudflarestorage.com",
        region_name="auto",
        aws_access_key_id=required("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4",connect_timeout=15,read_timeout=60,
                      retries={"max_attempts":3},s3={"addressing_style":"path"}),
    )


def missing_exception(e):
    return str(getattr(e,"response",{}).get("Error",{}).get("Code")) in (
        "404","NoSuchKey","NotFound"
    )


def immutable_put(client,key,src,expected):
    if not key.startswith(R2_PREFIX) or \
       not re.fullmatch(r"[0-9a-f]{64}",expected):
        raise ValueError("Unexpected R2 archive prefix or checksum")
    try:
        head=client.head_object(Bucket=BUCKET,Key=key)
    except Exception as error:
        if not missing_exception(error):
            raise
    else:
        if head.get("ContentLength")!=src.stat().st_size or \
           head.get("Metadata",{}).get("sha256")!=expected:
            raise ValueError("Existing immutable backup object has unexpected size/hash")
        return "already present"
    client.upload_file(str(src),BUCKET,key,
        ExtraArgs={"ContentType":"application/gzip","CacheControl":"private, no-store",
                   "Metadata":{"sha256":expected}})
    head=client.head_object(Bucket=BUCKET,Key=key)
    if head.get("ContentLength")!=src.stat().st_size or \
       head.get("Metadata",{}).get("sha256")!=expected:
        raise ValueError("Backup upload not verified by R2 HEAD")
    return "new"


def restore_verify(downloaded,expected_entries,manifest_bytes,restored):
    expected={e["privateArchiveMember"]:e for e in expected_entries}
    seen=set()
    with tarfile.open(downloaded,"r:gz") as archive:
        for info in archive:
            name=info.name
            if name=="kv-manifest.json":
                if not info.isfile():
                    raise ValueError("KV manifest is not regular file")
                raw=archive.extractfile(info).read()
                if raw!=manifest_bytes:
                    raise ValueError("Private backup manifest bytes changed")
                continue
            if name not in expected or name in seen or not info.isfile() or \
               not re.fullmatch(r"images/[0-9a-f]{64}\.jpg",name):
                raise ValueError("Unexpected private KV tar member")
            data=archive.extractfile(info).read()
            if len(data)!=expected[name]["bytes"] or sha(data)!=expected[name]["valueSha256"]:
                raise ValueError("Restored KV JPEG has different bytes/hash")
            restored[name]=data
            seen.add(name)
    if seen!=set(expected):
        raise ValueError("Private R2 archive lacks one or more KV previews")
    return len(seen)


def execute():
    if required("GITHUB_REPOSITORY")!=SOURCE_REPO or \
       required("GITHUB_REF")!=SOURCE_REF or \
       required("GITHUB_EVENT_NAME")!="push" or required("R2_BUCKET")!=BUCKET:
        raise ValueError("KV backup allowed only on isolated branch and private R2 bucket")
    account=required("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[0-9a-fA-F]{32}",account):
        raise ValueError("Incorrect account ID")
    ns=cf_namespace()
    base="https://api.cloudflare.com/client/v4/accounts/"+account+"/storage/kv/namespaces/"+ns
    s=cf_session()
    records=get_keys(s,base)
    total=0
    entries=[]
    # We store actual names and key metadata ONLY in the PRIVATE archive.
    with tempfile.TemporaryDirectory(prefix="pp-kv-preserve-") as td:
        basepath=Path(td)
        store=basepath/"images"
        store.mkdir()
        for n,item in enumerate(records,1):
            data=read_jpeg(s,base,item["name"])
            total+=len(data)
            if total>MAX_TOTAL_BYTES:
                raise ValueError("KV preview total size exceeds 1 GiB safety limit")
            digest=sha(data)
            private_name=sha(item["name"].encode("utf8"))
            member="images/"+private_name+".jpg"
            (store/(private_name+".jpg")).write_bytes(data)
            entries.append({
                "name":item["name"],
                "keySha256":private_name,
                "privateArchiveMember":member,
                "valueSha256":digest,
                "bytes":len(data),
                "expiration":item["expiration"],
                "metadata":item["metadata"],
            })
            if n%100==0 or n==len(records):
                print("Read-only verified KV source:",n,"/",len(records),flush=True)
        manifest={
            "schemaVersion":1,
            "source":"Cloudflare Workers KV binding PREVIEW_KV",
            "sourceAccountIdNotIncluded":True,
            "prefix":KV_PREFIX,
            "count":len(entries),
            "totalBytes":total,
            "records":entries,
            "notIndependentFromFutureCloudflareProduction":True,
            "preserveExactKeyNames":True,
            "noSourceMutations":True,
        }
        manifest_bytes=(json.dumps(manifest,sort_keys=True,separators=(",",":"))+"\n").encode()
        package=basepath/"kv-preview-images.tar.gz"
        with tarfile.open(package,"w:gz",compresslevel=3) as archive:
            manifest_info=tarfile.TarInfo("kv-manifest.json")
            manifest_info.size=len(manifest_bytes)
            manifest_info.mtime=0
            manifest_info.uid=manifest_info.gid=0
            archive.addfile(manifest_info,io.BytesIO(manifest_bytes))
            for entry in entries:
                p=store/(entry["keySha256"]+".jpg")
                i=archive.gettarinfo(str(p),arcname=entry["privateArchiveMember"])
                i.mtime=0
                i.uid=i.gid=0
                i.uname=i.gname=""
                with p.open("rb") as f:
                    archive.addfile(i,f)
        objsha,objsize=hashfile(package)
        target=R2_PREFIX+objsha+".tar.gz"
        client=r2_client()
        action=immutable_put(client,target,package,objsha)
        print("Private R2 KV snapshot:",action,"bytes:",objsize,flush=True)
        downloaded=basepath/"returned.tar.gz"
        client.download_file(BUCKET,target,str(downloaded))
        actual_size=downloaded.stat().st_size
        gotsha,_=hashfile(downloaded)
        if actual_size!=objsize or gotsha!=objsha:
            raise ValueError("Downloaded R2 KV backup does not match exact tar bytes")
        actual=restore_verify(downloaded,entries,manifest_bytes,{})
        if actual!=len(records):
            raise ValueError("KV restored media count differs")
        # Only anonymous report leaves the isolated Actions runner.
        report={
            "schemaVersion":1,
            "status":"passed",
            "source":"Cloudflare Workers KV social previews",
            "sourceItemCount":len(records),
            "sourceBytes":total,
            "storage":"private Cloudflare R2 test bucket",
            "privateR2ObjectKey":target,
            "archiveSha256":objsha,
            "archiveBytes":objsize,
            "restoredAllMediaSHA256":True,
            "verifiedCount":actual,
            "privateManifestInsideArchive":True,
            "actualShareTokensInReport":False,
            "reportGeneratedAt":datetime.now(timezone.utc).isoformat(),
            "backupProvisional":True,
            "notIndependentFromCloudflare":True,
            "sourceKVReadOnly":True,
            "records":[
                {"keySha256":e["keySha256"],"valueSha256":e["valueSha256"],
                 "bytes":e["bytes"],"expiration":e["expiration"]}
                for e in entries
            ],
        }
        out=Path(required("KV_BACKUP_REPORT_DIR"))
        out.mkdir(parents=True,exist_ok=True)
        (out/"kv-preservation-report.json").write_text(
            json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
        print("RELEASE A KV PREVIEW BACKUP & RESTORE VERIFIED:",actual,"files,",
              total,"bytes",flush=True)


if __name__=="__main__":
    try:
        execute()
    except Exception as exc:
        # Never print actual keys, bearer credentials or full Cloudflare URI.
        print("KV preservation failed:",type(exc).__name__,
              str(exc).splitlines()[0][:200],file=sys.stderr)
        sys.exit(1)
