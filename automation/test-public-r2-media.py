#!/usr/bin/env python3
"""Release A: real public R2 HTTPS/CORS + browser/WebGL validation.

Uses actual published 2026-11-09 media staged in a separate disposable
media-only bucket. Opens the existing GitHub Pages gallery in Chromium,
Firefox and WebKit: no editing the site, no production deploy, no credentials.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

ORIGIN="https://southernadd-cmyk.github.io"
GALLERY_URL=ORIGIN+"/algoart/gallery/2026-11-09/"
BUCKET="proportion-piece-media-test"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_manifest(m):
    if m.get("bucket")!=BUCKET or m.get("origin")!=ORIGIN or \
       m.get("sourceDate")!="2026-11-09" or len(m.get("objects",[]))!=7:
        raise ValueError("Unexpected public test manifest contents")
    base=m.get("publicMediaBaseURL")
    if not isinstance(base,str) or not base.startswith("https://"):
        raise ValueError("Media-only test origin invalid")
    for rec in m["objects"]:
        if rec.get("url")!=base+"/"+rec.get("key","") or \
           not rec.get("key","").startswith("_release-a-public-media-test/") or \
           len(rec.get("sha256",""))!=64 or rec.get("bytes",0)<1000 or \
           rec.get("contentType") not in ("image/jpeg","image/webp"):
            raise ValueError("Unsafe or incomplete media-only test record")


def http_check(m):
    import requests
    session=requests.Session()
    for rec in m["objects"]:
        response=session.get(rec["url"],headers={"Origin":ORIGIN,"Cache-Control":"no-cache"},
                             allow_redirects=False,timeout=(15,50))
        if response.status_code!=200 or \
           response.headers.get("Access-Control-Allow-Origin")!=ORIGIN or \
           not response.headers.get("Content-Type","").startswith(rec["contentType"]):
            raise ValueError("Media public HTTP/MIME/CORS validation failed")
        if len(response.content)!=rec["bytes"] or sha(response.content)!=rec["sha256"]:
            raise ValueError("Media public SHA-256 differs from original")
    negative=session.get(m["objects"][0]["url"],
                         headers={"Origin":"https://unrelated.example"},
                         allow_redirects=False,timeout=(15,50))
    if negative.status_code!=200 or negative.headers.get("Access-Control-Allow-Origin") in (
        "*","https://unrelated.example"):
        raise ValueError("Media public bucket CORS is overbroad")
    print("Public HTTPS MIME, exact SHA-256 and strict CORS verified: 7/7")


JS_CHECK = r"""async (entries) => {
 const report=[];
 for(const obj of entries){
   const r=await fetch(obj.url,{mode:'cors',credentials:'omit',cache:'no-store'});
   if(!r.ok || r.type!=='cors')throw new Error('CORS fetch blocked for '+obj.key);
   const bytes=await r.arrayBuffer();
   if(bytes.byteLength!==obj.bytes)throw new Error('CORS body length differs: '+obj.key);
   const image=new Image();
   image.crossOrigin='anonymous';
   image.src=obj.url;
   await image.decode();
   if(image.naturalWidth<100 || image.naturalHeight<100)
     throw new Error('Image decoder returned invalid dimensions: '+obj.key);
   const canvas=document.createElement('canvas');
   canvas.width=canvas.height=16;
   const gl=canvas.getContext('webgl',{preserveDrawingBuffer:true,antialias:false});
   let webglTextureUploaded=false;
   if(gl){
     const tex=gl.createTexture();
     gl.bindTexture(gl.TEXTURE_2D,tex);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
     gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
     if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL texture upload failed: '+obj.key);
     gl.deleteTexture(tex);
     webglTextureUploaded=true;
   }
   report.push({
     key:obj.key,mime:obj.contentType,width:image.naturalWidth,
     height:image.naturalHeight,corsFetch:true,webglTextureUploaded
   });
 }
 return report;
}"""


def browsers_check(m):
    from playwright.sync_api import sync_playwright
    out=[]
    with sync_playwright() as playwright:
        for name in ("chromium","firefox","webkit"):
            engine=getattr(playwright,name)
            launch={"headless":True,"timeout":60_000}
            if name=="chromium":
                launch["args"]=[
                  "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
                ]
            browser=engine.launch(**launch)
            try:
                page=browser.new_page()
                result=page.goto(GALLERY_URL,wait_until="domcontentloaded",timeout=60_000)
                if result is None or result.status!=200:
                    raise ValueError(name+" GitHub Pages gallery origin unavailable")
                checks=page.evaluate(JS_CHECK,m["objects"])
                if len(checks)!=7 or not all(c["corsFetch"] for c in checks):
                    raise ValueError(name+" cross-origin image decoding incomplete")
                gpu=sum(1 for c in checks if c["webglTextureUploaded"])
                if name=="chromium" and gpu!=7:
                    raise ValueError("Chromium GPU/WebGL image texture uploads incomplete")
                print(name,": 7/7 image fetch/decode, WebGL uploaded",gpu,"/7")
                out.append({"browser":name,"galleryStatus":result.status,
                            "fetchAndDecode":7,"gpuTextureUploads":gpu})
            finally:
                browser.close()
    return out


def main():
    if sys.argv[1:]==["--self-test"]:
        print("R2 public media browser script parsed and self-test mode available")
        return
    if sys.argv[1:]:
        raise ValueError("Unknown command-line arguments")
    if os.environ.get("GITHUB_REF")!="refs/heads/plan/archive-storage-foundation-20261109" or \
       os.environ.get("GITHUB_REPOSITORY")!="southernadd-cmyk/algoart":
        raise ValueError("Media tests may run only on the isolated branch")
    file=Path(os.environ["R2_MEDIA_TEST_MANIFEST"])
    manifest=json.loads(file.read_text("utf8"))
    verify_manifest(manifest)
    http_check(manifest)
    checks=browsers_check(manifest)
    report={
        "status":"passed","testedAtUTC":datetime.now(timezone.utc).isoformat(),
        "sourceGallery":GALLERY_URL,"mediaBucket":BUCKET,
        "mediaSampleCount":7,"bytesAndMIMEVerified":True,"corsStrict":True,
        "browsers":checks,"notProduction":True,
        "limits":["Quest 3 hardware not tested",
                  "r2.dev does not verify final production custom domain"],
    }
    dest=Path(os.environ["R2_MEDIA_BROWSER_REPORT"])
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print("RELEASE A MEDIA-ONLY PUBLIC DELIVERY TEST PASSED")


if __name__=="__main__":
    try:
        main()
    except Exception as error:
        print("Public media browser check failed:",type(error).__name__,
              str(error).splitlines()[0][:200],file=sys.stderr)
        sys.exit(1)
