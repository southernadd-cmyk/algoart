#!/usr/bin/env python3
"""One-shot REAL workers.dev R2 media gateway test, never changes live Pages.
Uploads two exact temporary immutable-key media objects to the existing
proportion-piece-media-test bucket, tests real media Worker GET/HEAD/CORS,
Chromium decode and WebGL, then deletes ONLY this run's two objects.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlparse
import requests

WORKER = "https://proportion-piece-media.mr-adam-clement.workers.dev"
BUCKET = "proportion-piece-media-test"
ORIGIN = "https://southernadd-cmyk.github.io"
DATE = "2026-11-09"
BRANCH = "refs/heads/plan/archive-storage-foundation-20261109"
REPO = "southernadd-cmyk/algoart"
OUT = Path("worker-endpoint-report.json")

def sha(data):
    return hashlib.sha256(data).hexdigest()

def needed(k):
    x=os.environ.get(k,"").strip()
    if not x: raise RuntimeError("Missing required setting: "+k)
    return x

def guard():
    assert needed("GITHUB_REPOSITORY")==REPO
    assert needed("GITHUB_REF")==BRANCH
    assert needed("GITHUB_EVENT_NAME")=="push"
    assert needed("R2_MEDIA_BUCKET")==BUCKET
    run=needed("GITHUB_RUN_ID")
    attempt=needed("GITHUB_RUN_ATTEMPT")
    assert re.fullmatch(r"\d{1,20}",run)
    assert re.fullmatch(r"\d{1,5}",attempt)
    if urlparse(WORKER).hostname!="proportion-piece-media.mr-adam-clement.workers.dev":
        raise RuntimeError("Unexpected Worker hostname")
    return f"2026-11-09-G01-probe-{run}-{attempt}"

def s3():
    import boto3
    from botocore.config import Config
    account=needed("R2_ACCOUNT_ID")
    assert re.fullmatch(r"[0-9a-fA-F]{32}",account)
    return boto3.client("s3",endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
      aws_access_key_id=needed("R2_MEDIA_ACCESS_KEY_ID"),
      aws_secret_access_key=needed("R2_MEDIA_SECRET_ACCESS_KEY"),
      region_name="auto",config=Config(signature_version="s3v4",connect_timeout=15,
       read_timeout=40,retries={"max_attempts":2},s3={"addressing_style":"path"}))

def source():
    root=Path("live-snapshot")/"gallery"/DATE
    meta=json.loads((root/"meta.json").read_text())
    textures=json.loads((root/"3d/manifest.json").read_text())
    artwork=next(e for e in meta["entries"] if e["id"]=="2026-11-09-G01")
    name=artwork["imageFile"]
    variant=textures["images"][name]["desktop"]
    inputs=[("original","image/jpeg",root/name),
            ("desktop","image/webp",root/variant)]
    for role,mime,p in inputs:
        data=p.read_bytes()
        assert len(data)>1000
        if mime=="image/jpeg": assert data[:2]==b"\xff\xd8"
        if mime=="image/webp": assert data[:4]==b"RIFF" and data[8:12]==b"WEBP"
    return inputs

def browser_check(objects):
    from playwright.sync_api import sync_playwright
    # Run on the real GitHub Pages gallery origin to test cross-origin WebGL.
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
        try:
            page=browser.new_page()
            page.goto(ORIGIN+"/algoart/gallery/"+DATE+"/",wait_until="domcontentloaded",timeout=60000)
            result=page.evaluate("""async objects => {
               let glCanvas=document.createElement('canvas');
               const gl=glCanvas.getContext('webgl',{preserveDrawingBuffer:true,antialias:false});
               if(!gl) throw Error('Chromium WebGL unavailable');
               const checks=[];
               for(const obj of objects) {
                 const image=new Image();
                 image.crossOrigin='anonymous';
                 image.src=obj.url;
                 await image.decode();
                 if(image.naturalWidth<100||image.naturalHeight<100)
                   throw Error('Invalid image dimensions '+obj.role);
                 const texture=gl.createTexture();
                 gl.bindTexture(gl.TEXTURE_2D,texture);
                 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
                 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
                 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
                 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
                 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
                 if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL upload failed '+obj.role);
                 gl.deleteTexture(texture);
                 checks.push({role:obj.role,width:image.naturalWidth,height:image.naturalHeight,webgl:true});
               }
               return checks;
            }""",[{"role":x["role"],"url":x["url"]} for x in objects])
            assert len(result)==2 and all(x["webgl"] for x in result)
            return result
        finally: browser.close()

def verify(objects):
    summary={"worker":WORKER,"date":DATE,"assets":[],"productionChanges":False,
             "existingMediaOnly":True}
    home=requests.get(WORKER+"/",timeout=20)
    assert home.status_code==404,("Worker homepage should be 404",home.status_code)
    summary["homepage404Expected"]=True
    for item in objects:
        r=requests.get(item["url"],headers={"Origin":ORIGIN},timeout=(15,50),allow_redirects=False)
        assert r.status_code==200,(item["role"],"GET",r.status_code,r.text[:200])
        assert sha(r.content)==item["sha256"],("SHA mismatch",item["role"])
        assert len(r.content)==item["bytes"]
        assert r.headers.get("Content-Type","").startswith(item["mime"])
        assert r.headers.get("Access-Control-Allow-Origin")==ORIGIN
        assert "immutable" in r.headers.get("Cache-Control","")
        h=requests.head(item["url"],headers={"Origin":ORIGIN},timeout=25)
        assert h.status_code==200,(item["role"],"HEAD",h.status_code)
        assert h.headers.get("Content-Type","").startswith(item["mime"])
        assert int(h.headers.get("Content-Length","0"))==item["bytes"]
        assert h.headers.get("Access-Control-Allow-Origin")==ORIGIN
        p=requests.options(item["url"],headers={"Origin":ORIGIN,"Access-Control-Request-Method":"GET"},timeout=25)
        assert p.status_code==204,("preflight failed",p.status_code)
        assert p.headers.get("Access-Control-Allow-Origin")==ORIGIN
        repeat=requests.get(item["url"],headers={"Origin":ORIGIN},timeout=(15,50))
        assert repeat.status_code==200 and sha(repeat.content)==item["sha256"]
        summary["assets"].append({"role":item["role"],"bytes":item["bytes"],
          "sha256":item["sha256"],"mime":item["mime"],
          "get200":True,"head200":True,"cors":True,
          "cacheControl":r.headers.get("Cache-Control"),
          "cfCacheStatusFirst":r.headers.get("CF-Cache-Status"),
          "cfCacheStatusSecond":repeat.headers.get("CF-Cache-Status")})
    summary["browser"]=browser_check(objects)
    return summary

def main():
    probe=guard()
    c=s3()
    sources=source()
    records=[]
    for role,mime,path in sources:
        data=path.read_bytes()
        digest=sha(data)
        ext="jpg" if mime=="image/jpeg" else "webp"
        key=f"editions/{DATE}/{probe}/{role}-{digest}.{ext}"
        records.append({"role":role,"key":key,"url":WORKER+"/"+key,
            "data":data,"sha256":digest,"bytes":len(data),"mime":mime})
    assert len(records)==2
    touched=[]
    test_error=None
    try:
        # No overwrites: hard stop if a deterministic run-specific test key exists.
        from botocore.exceptions import ClientError
        for item in records:
            try:
                c.head_object(Bucket=BUCKET,Key=item["key"])
            except ClientError as exc:
                status=exc.response.get("ResponseMetadata",{}).get("HTTPStatusCode")
                assert status==404,("Cannot establish test key absence",status)
            else:
                raise RuntimeError("Refusing to overwrite existing R2 key: "+item["key"])
        for item in records:
            touched.append(item["key"])  # Track BEFORE PUT for guaranteed cleanup.
            c.put_object(Bucket=BUCKET,Key=item["key"],Body=item["data"],
                ContentType=item["mime"],CacheControl="public, max-age=31536000, immutable",
                Metadata={"sha256":item["sha256"]})
            head=c.head_object(Bucket=BUCKET,Key=item["key"])
            assert head["ContentLength"]==item["bytes"]
            assert head.get("Metadata",{}).get("sha256")==item["sha256"]
            assert head["ContentType"].startswith(item["mime"])
        summary=verify(records)
        summary["result"]="PASS"
        print("PASS: Worker homepage 404 expected; 2/2 JPEG+WebP real GET, HEAD, CORS, SHA256, WebGL")
    except Exception as e:
        summary={"result":"FAIL","error":repr(e),"worker":WORKER,"date":DATE}
        test_error=e
        print("FAIL: "+repr(e),file=sys.stderr)
    finally:
        cleanup_error=None
        for key in touched:
            try:
                c.delete_object(Bucket=BUCKET,Key=key)
                try:
                    c.head_object(Bucket=BUCKET,Key=key)
                    raise RuntimeError("Key still present after cleanup")
                except Exception as err:
                    from botocore.exceptions import ClientError
                    if not isinstance(err,ClientError) or err.response.get("ResponseMetadata",{}).get("HTTPStatusCode")!=404:
                        raise
            except Exception as e:
                cleanup_error=e
        summary["cleanup"]={"attempted":len(touched),"allDeleted":cleanup_error is None}
        OUT.write_text(json.dumps(summary,indent=2))
        if cleanup_error: raise cleanup_error
        print("CLEANUP PASS: removed only "+str(len(touched))+" exact disposable Worker test objects")
        if test_error: raise test_error

if __name__=="__main__":
    main()
