#!/usr/bin/env python3
"""Release A: verified, private R2 snapshots of public GitHub Release assets.

Runs only on isolated planning branch, accesses releases READ ONLY, retains an
immutable archive in the PRIVATE test bucket, downloads and restores every
asset with the SHA-256 digest reported by GitHub. No production changes.
"""
import hashlib
import json
import os
import re
from pathlib import Path
import sys
import tarfile
import tempfile
import time
from urllib.parse import quote

REPO="southernadd-cmyk/algoart"
REF="refs/heads/plan/archive-storage-foundation-20261109"
BUCKET="proportion-piece-archive-test"
TAGS={"proportion-piece-eight-prints-2026-11-03","algoart-social-2026-10","algoart-social-2026-11","algoart-social-live"}
PREFIX="_release-a-provisional-backup/github-releases/"

def get(k):
    val=os.environ.get(k,"").strip()
    if not val:
        raise ValueError("Missing required environment setting "+k)
    return val

def sha_file(path):
    h=hashlib.sha256()
    length=0
    with open(path,"rb") as f:
        while (block:=f.read(1024*1024)):
            h.update(block)
            length+=len(block)
    return h.hexdigest(),length

def git_api(session, route, params=None):
    import requests
    uri="https://api.github.com/repos/"+REPO+route
    for attempt in range(4):
        res=session.get(uri,params=params,timeout=(15,60))
        if res.status_code in (429,502,503,504) and attempt<3:
            time.sleep(2**attempt)
            continue
        res.raise_for_status()
        return res.json()
    raise RuntimeError("GitHub API did not respond successfully")

def release_snapshot(session,tag):
    release=git_api(session,"/releases/tags/"+quote(tag,safe=""))
    if release.get("tag_name")!=tag or not release.get("id"):
        raise ValueError("Release tag identity changed")
    assets=[]
    for page in range(1,30):
        portion=git_api(session,"/releases/"+str(release["id"])+"/assets",{"per_page":100,"page":page})
        if not isinstance(portion,list):
            raise ValueError("GitHub release asset list malformed")
        assets.extend(portion)
        if len(portion)<100:
            break
    else:
        raise ValueError("Unexpectedly large release")
    if not assets or len(assets)>2000 or len({a["id"] for a in assets})!=len(assets):
        raise ValueError("Empty release, duplicate IDs or excessive release size")
    for asset in assets:
        if not re.fullmatch(r"sha256:[a-f0-9]{64}",asset.get("digest") or ""):
            raise ValueError("Missing upstream SHA-256 digest for "+asset.get("name","unknown"))
        if not isinstance(asset.get("size"),int) or asset["size"]<=0:
            raise ValueError("Invalid release asset size")
        if not re.fullmatch(r"[\w.() +@-]{1,240}",asset.get("name","")):
            raise ValueError("Unsafe release asset filename")
        if not asset["browser_download_url"].startswith("https://github.com/"+REPO+"/releases/download/"+tag+"/"):
            raise ValueError("Unexpected release asset download origin")
    return release,sorted(assets,key=lambda a:a["id"])

def get_asset(asset,target):
    import requests
    expected=asset["digest"].split(":",1)[1]
    maximum=asset["size"]
    for attempt in range(4):
        try:
            with requests.get(asset["browser_download_url"],stream=True,
                              headers={"User-Agent":"proportion-piece-recovery-audit"},
                              timeout=(20,90)) as response:
                response.raise_for_status()
                total=0
                h=hashlib.sha256()
                with target.open("wb") as f:
                    for chunk in response.iter_content(1024*1024):
                        if not chunk:
                            continue
                        total+=len(chunk)
                        if total>maximum:
                            raise ValueError("Release asset exceeded expected size")
                        h.update(chunk)
                        f.write(chunk)
            if total!=maximum or h.hexdigest()!=expected:
                raise ValueError("GitHub asset checksum mismatch")
            return
        except Exception:
            target.unlink(missing_ok=True)
            if attempt==3:
                raise
            time.sleep(2**attempt)

def r2():
    import boto3
    from botocore.config import Config
    account=get("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[a-fA-F0-9]{32}",account):
        raise ValueError("Invalid R2 Account ID")
    return boto3.client("s3",endpoint_url="https://"+account+".r2.cloudflarestorage.com",
        aws_access_key_id=get("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=get("R2_SECRET_ACCESS_KEY"),region_name="auto",
        config=Config(signature_version="s3v4",connect_timeout=20,read_timeout=120,
                      retries={"max_attempts":3},s3={"addressing_style":"path"}))

def store(client,tag,key,source,digest,ctype):
    from boto3.s3.transfer import TransferConfig
    if not key.startswith(PREFIX+tag+"/"):
        raise ValueError("Unsafe R2 private backup key")
    try:
        h=client.head_object(Bucket=BUCKET,Key=key)
        if h["ContentLength"]!=source.stat().st_size or h.get("Metadata",{}).get("sha256")!=digest:
            raise ValueError("Existing backup object digest metadata differs")
        return "existing"
    except Exception as error:
        if str(getattr(error,"response",{}).get("Error",{}).get("Code")) not in ("404","NoSuchKey","NotFound"):
            raise
    client.upload_file(str(source),BUCKET,key,
        ExtraArgs={"ContentType":ctype,"CacheControl":"private,no-store",
                   "Metadata":{"sha256":digest,"releasetag":tag}},
        Config=TransferConfig(multipart_threshold=32*1024*1024,
                              multipart_chunksize=16*1024*1024,max_concurrency=4))
    h=client.head_object(Bucket=BUCKET,Key=key)
    if h["ContentLength"]!=source.stat().st_size or h.get("Metadata",{}).get("sha256")!=digest:
        raise ValueError("R2 object size or checksum metadata mismatch")
    return "new"

def restore_all(bundle,records,folder):
    found=set()
    reference={r["entry"]:r for r in records}
    with tarfile.open(bundle,"r:gz") as archive:
        for member in archive:
            name=member.name
            if not re.fullmatch(r"assets/[0-9]+/[\w.() +@-]{1,240}",name) or \
               not member.isfile() or name not in reference or name in found:
                raise ValueError("Unexpected or unsafe restored archive entry")
            found.add(name)
            path=folder/name
            path.parent.mkdir(parents=True,exist_ok=True)
            stream=archive.extractfile(member)
            if stream is None:
                raise ValueError("Missing tar entry content")
            with path.open("wb") as f:
                while (chunk:=stream.read(1024*1024)):
                    f.write(chunk)
            digest,n=sha_file(path)
            if digest!=reference[name]["sha256"] or n!=reference[name]["bytes"]:
                raise ValueError("Restored file digest mismatch")
    if found!=set(reference):
        raise ValueError("Release archive missing restored asset")
    return len(found)

def main():
    if get("GITHUB_REPOSITORY")!=REPO or get("GITHUB_REF")!=REF or \
       get("GITHUB_EVENT_NAME")!="push" or get("R2_BUCKET")!=BUCKET:
        raise ValueError("Release backup restricted to planning branch and private test bucket")
    tag=get("RELEASE_BACKUP_TAG")
    if tag not in TAGS:
        raise ValueError("Release tag not allowlisted")
    import requests
    session=requests.Session()
    session.headers.update({"Authorization":"Bearer "+get("GH_TOKEN"),
                            "Accept":"application/vnd.github+json",
                            "X-GitHub-Api-Version":"2022-11-28",
                            "User-Agent":"proportion-piece-recovery-audit"})
    release,assets=release_snapshot(session,tag)
    print("Source:",tag,"assets:",len(assets),"bytes:",sum(a["size"] for a in assets),flush=True)
    reportdir=Path(get("BACKUP_REPORT_DIR"))
    reportdir.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pp-gh-release-") as tmp:
        root=Path(tmp)
        downloads=root/"download"
        downloads.mkdir()
        records=[]
        for idx,a in enumerate(assets,1):
            path=downloads/(str(a["id"])+".bin")
            get_asset(a,path)
            digest,n=sha_file(path)
            if digest!=a["digest"][7:] or n!=a["size"]:
                raise ValueError("Source asset hash/length mismatch")
            records.append({"id":a["id"],"name":a["name"],
                            "entry":"assets/"+str(a["id"])+"/"+a["name"],
                            "bytes":n,"sha256":digest,
                            "contentType":a.get("content_type"),
                            "sourceURL":a["browser_download_url"]})
            if idx%100==0 or idx==len(assets):
                print("Upstream asset checks:",idx,"/",len(assets),flush=True)
        bundle=root/"release.tar.gz"
        with tarfile.open(bundle,"w:gz",compresslevel=1) as archive:
            for a in records:
                entry=archive.gettarinfo(str(downloads/(str(a["id"])+".bin")),arcname=a["entry"])
                entry.uid=entry.gid=entry.mtime=0
                entry.uname=entry.gname=""
                with (downloads/(str(a["id"])+".bin")).open("rb") as f:
                    archive.addfile(entry,f)
        digest,n=sha_file(bundle)
        key=PREFIX+tag+"/"+digest+".tar.gz"
        client=r2()
        result=store(client,tag,key,bundle,digest,"application/gzip")
        print("Private R2 archive:",result,"bytes:",n,flush=True)
        downloaded=root/"returned.tar.gz"
        client.download_file(BUCKET,key,str(downloaded))
        got,length=sha_file(downloaded)
        if got!=digest or length!=n:
            raise ValueError("R2 tarball SHA-256/length mismatch")
        restored=restore_all(downloaded,records,root/"restored")
        if restored!=len(assets):
            raise ValueError("Restored count differs")
        manifest={
          "version":1,"verified":True,"provisional":True,"repo":REPO,
          "release":tag,"releaseId":release["id"],"assetCount":restored,
          "sourceBytes":sum(a["bytes"] for a in records),
          "archiveBytes":n,"archiveSha256":digest,"storageKey":key,
          "verifiedAtUTC":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
          "originalGitHubDigestsVerified":True,"fullRemoteRestoreVerified":True,
          "sameCloudflareAccountAsFutureProduction":True,"assets":records,
        }
        mdata=(json.dumps(manifest,sort_keys=True,separators=(",",":"))+"\n").encode()
        manifest_file=root/"manifest.json"
        manifest_file.write_bytes(mdata)
        mkey=PREFIX+tag+"/"+digest+"/manifest.json"
        store(client,tag,mkey,manifest_file,hashlib.sha256(mdata).hexdigest(),"application/json")
        if client.get_object(Bucket=BUCKET,Key=mkey)["Body"].read()!=mdata:
            raise ValueError("R2 backup manifest cannot be read back")
        (reportdir/(tag+".json")).write_bytes(mdata)
        print("RELEASE A RELEASE BACKUP VERIFIED:",tag,restored,"assets",flush=True)

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("Release backup failed:",type(exc).__name__,
              str(exc).splitlines()[0][:200],file=sys.stderr)
        sys.exit(1)
