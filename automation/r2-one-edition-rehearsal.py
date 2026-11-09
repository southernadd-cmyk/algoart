#!/usr/bin/env python3
"""Release A: reversible FULL EDITION media-only R2 migration rehearsal.

Only the 2026-11-09 published 16-artwork edition is staged, as 16 original JPEGs,
32 WebP tower textures, 1 archive cover and 1 portrait sculpture source.
Source is a READ-ONLY checkout of main. The private R2 backup bucket is never
accessed; no live pages, workflows or published references are changed.

Commands: self-test, stage, verify, cleanup. Delete ONLY this run's manifest
keys, even when the shared media bucket contains unrelated pre-existing objects.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

BUCKET = "proportion-piece-media-test"
PRIVATE_BUCKET = "proportion-piece-archive-test"  # guard only; never API argument
REPO = "southernadd-cmyk/algoart"
BRANCH = "refs/heads/plan/archive-storage-foundation-20261109"
ORIGIN = "https://southernadd-cmyk.github.io"
DAY = "2026-11-09"
KEY_ROOT = "_release-a-edition-rehearsal"
EXPECTED = {"originals": 16, "textures": 32, "cover": 1, "sculptures": 1}
SOURCE = Path("live-snapshot")
MANIFEST_PATH = Path(os.getenv("R2_EDITION_REHEARSAL_MANIFEST",
                            "/tmp/pp-edition-rehearsal/manifest.json"))
REPORT_PATH = Path(os.getenv("R2_EDITION_REHEARSAL_REPORT",
                          "/tmp/pp-edition-rehearsal/report.json"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError("Required isolated test setting missing: " + name)
    return value


def scope():
    if require("GITHUB_REPOSITORY") != REPO or require("GITHUB_REF") != BRANCH:
        raise ValueError("Not on authorised isolated planning branch")
    if require("GITHUB_EVENT_NAME") != "push":
        raise ValueError("One-shot branch push required")
    if require("R2_MEDIA_BUCKET") != BUCKET:
        raise ValueError("Wrong media bucket; refuse to continue")
    run, attempt = require("GITHUB_RUN_ID"), require("GITHUB_RUN_ATTEMPT")
    if not re.fullmatch(r"\d{1,20}", run) or not re.fullmatch(r"\d{1,5}", attempt):
        raise ValueError("Unsafe run identifier")
    return f"{KEY_ROOT}/{run}/{attempt}/"


def public_base():
    u = urlparse(require("R2_MEDIA_PUBLIC_URL").rstrip("/"))
    if (u.scheme != "https" or not u.hostname or
        not u.hostname.lower().endswith(".r2.dev") or
        u.username or u.password or u.port or u.path not in ("", "/") or
        u.query or u.fragment):
        raise ValueError("Use media-only public https://pub-...r2.dev origin")
    if "proportion-piece-archive-test" in u.hostname.lower():
        raise ValueError("Private bucket must never be public")
    return "https://" + u.hostname.lower()


def client():
    import boto3
    from botocore.config import Config
    account = require("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", account):
        raise ValueError("Bad Cloudflare account ID")
    return boto3.client("s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=require("R2_MEDIA_ACCESS_KEY_ID"),
        aws_secret_access_key=require("R2_MEDIA_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4", connect_timeout=15,
                      read_timeout=45, retries={"max_attempts": 2},
                      s3={"addressing_style": "path"}))


def load_json(relative):
    return json.loads((SOURCE / relative).read_text("utf-8"))


def source_files():
    edition = load_json(f"gallery/{DAY}/meta.json")
    textures = load_json(f"gallery/{DAY}/3d/manifest.json")
    if len(edition["entries"]) != EXPECTED["originals"] or \
       len(textures["images"]) != EXPECTED["originals"]:
        raise ValueError("Unexpected artwork or texture manifest count")
    original = {}
    derived = {}
    seen_ids = set()
    for item in edition["entries"]:
        if item["id"] in seen_ids:
            raise ValueError("Duplicate edition artwork ID")
        seen_ids.add(item["id"])
        file = item["imageFile"]
        if ("/" in file or "\\" in file or ".." in file or
            not file.endswith(".jpg") or file not in textures["images"]):
            raise ValueError("Source manifest has invalid/non-local JPEG")
        original[file] = item
        for size in ("desktop", "mobile"):
            variant = textures["images"][file].get(size, "")
            if not re.fullmatch(r"3d/[A-Za-z0-9_-]+\.webp", variant):
                raise ValueError("Missing/unsafe 3D texture for " + file + ":" + size)
            derived[variant] = file
    if len(original) != 16 or len(derived) != 32:
        raise ValueError("Unexpected number of unique media assets")
    assets = []
    for file, item in original.items():
        assets.append((f"gallery/{DAY}/{file}", "image/jpeg", "original",
                      item["id"], file))
    for variant, file in derived.items():
        assets.append((f"gallery/{DAY}/{variant}", "image/webp", "texture",
                      original[file]["id"], file))
    assets.append((f"gallery/{DAY}/archive-preview.jpg", "image/jpeg",
                   "cover", None, None))
    assets.append((f"gallery/{DAY}/3d/sculptures.json.gz", "application/gzip",
                   "sculptures", None, None))
    assert len(assets) == sum(EXPECTED.values()) == 50
    return assets, edition, textures


def validate_source(path, mime, data):
    if len(data) < 1000:
        raise ValueError("Empty or tiny media source " + path)
    if mime == "image/jpeg" and not data.startswith(b"\xff\xd8"):
        raise ValueError("Invalid JPEG " + path)
    if mime == "image/webp" and not (data[:4] == b"RIFF" and data[8:12] == b"WEBP"):
        raise ValueError("Invalid WebP " + path)
    if mime == "application/gzip":
        if not data.startswith(b"\x1f\x8b"):
            raise ValueError("Invalid sculpture gzip")
        gzip.decompress(data)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf8")
    tmp.replace(path)


def manifest_keys(m, prefix):
    if (m.get("bucket") != BUCKET or m.get("prefix") != prefix or
        m.get("day") != DAY or m.get("origin") != ORIGIN):
        raise ValueError("Manifest does not match the exact isolated run")
    keys = []
    for item in m.get("assets", []):
        source = item.get("sourcePath", "")
        key = item.get("key", "")
        if (not re.fullmatch(r"gallery/2026-11-09/(?:3d/)?[A-Za-z0-9._-]+", source) or
            key != prefix + source or
            item.get("url") != m.get("baseURL", "") + "/" + key):
            raise ValueError("Unexpected test manifest key; refusing cleanup")
        keys.append(key)
    if len(keys) != len(set(keys)) or len(keys) > 50:
        raise ValueError("Duplicate or excessive test cleanup keys")
    return keys


def list_prefix(c, prefix):
    keys = []
    token = None
    while True:
        args = {"Bucket": BUCKET, "Prefix": prefix, "MaxKeys": 1000}
        if token:
            args["ContinuationToken"] = token
        result = c.list_objects_v2(**args)
        keys.extend(v["Key"] for v in result.get("Contents", []))
        if len(keys) > 100:
            raise ValueError("Unexpected object count in disposable run prefix")
        if not result.get("IsTruncated"):
            break
        token = result.get("NextContinuationToken")
        if not token:
            raise ValueError("Missing pagination token")
    return keys


def stage():
    prefix = scope()
    base = public_base()
    c = client()
    c.head_bucket(Bucket=BUCKET)
    if list_prefix(c, prefix):
        raise ValueError("Run's isolated staging prefix already contains objects")
    if MANIFEST_PATH.exists():
        raise ValueError("Run manifest already exists")
    assets, edition, textures = source_files()
    m = {"bucket": BUCKET, "prefix": prefix, "day": DAY, "origin": ORIGIN,
         "baseURL": base, "assets": [], "stateMetadataSource": f"gallery/{DAY}/meta.json",
         "textureManifestSource": f"gallery/{DAY}/3d/manifest.json",
         "artworkCount": len(edition["entries"]), "originalImageURLsUnchanged": True}
    write_json(MANIFEST_PATH, m)
    for file, mime, role, id, original in assets:
        data = (SOURCE / file).read_bytes()
        validate_source(file, mime, data)
        key = prefix + file
        record = {"sourcePath": file, "key": key, "url": base + "/" + key,
                  "sha256": sha(data), "bytes": len(data), "contentType": mime,
                  "role": role, "artworkId": id, "originalImageFile": original}
        # Persist exact upload intent BEFORE put_object so cleanup works on failure.
        m["assets"].append(record)
        manifest_keys(m, prefix)
        write_json(MANIFEST_PATH, m)
        c.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType=mime,
                     CacheControl="public, max-age=3600",
                     Metadata={"sha256": sha(data)})
        head = c.head_object(Bucket=BUCKET, Key=key)
        if (head["ContentLength"] != len(data) or
            head.get("Metadata", {}).get("sha256") != sha(data) or
            not head.get("ContentType", "").startswith(mime)):
            raise ValueError("R2 upload/HEAD mismatch for " + file)
    if len(m["assets"]) != 50:
        raise ValueError("Stage incomplete; not eligible for verification")
    print("STAGE PASS: 16 original JPEGs, 32 WebP textures, 1 gallery cover, 1 sculpture gzip; 50/50")
    return m


def verify_public(m):
    import requests
    session = requests.Session()
    checks = []
    for a in m["assets"]:
        response = session.get(a["url"], allow_redirects=False,
            headers={"Origin": ORIGIN}, timeout=(15, 50))
        if (response.status_code != 200 or
            response.headers.get("Access-Control-Allow-Origin") != ORIGIN or
            not response.headers.get("Content-Type", "").startswith(a["contentType"]) or
            len(response.content) != a["bytes"] or sha(response.content) != a["sha256"]):
            raise ValueError("Public R2 byte/MIME/CORS mismatch: " + a["sourcePath"])
        checks.append(a["sourcePath"])
    negative = session.get(m["assets"][0]["url"],
        headers={"Origin": "https://unrelated.example"},
        allow_redirects=False, timeout=(15, 50))
    if negative.headers.get("Access-Control-Allow-Origin") in ("*", "https://unrelated.example"):
        raise ValueError("CORS unexpectedly granted to another origin")
    print("PUBLIC PASS: 50/50 HTTPS, original bytes SHA-256, MIME and strict CORS")
    return checks


GALLERY_JS = r"""async ({entries,assets}) => {
  const artworks = document.querySelectorAll('article.art-card');
  if (artworks.length !== entries.length)
    throw Error('Gallery card count differs: '+artworks.length);
  const sources = new Map(assets.filter(a=>a.role==='original').map(a=>[a.originalImageFile,a]));
  const result = [];
  for (const item of entries) {
    const card = document.getElementById(item.id);
    if (!card) throw Error('Missing actual gallery card '+item.id);
    const img = card.querySelector('img');
    const remix = card.querySelector('a.remix');
    if (!img || !remix) throw Error('Missing original gallery markup '+item.id);
    const saved = img.getAttribute('src');
    if (saved !== item.imageFile || remix.href !== item.shareUrl)
      throw Error('Historical public image/link mismatch '+item.id);
    const target = sources.get(item.imageFile);
    if (!target) throw Error('Missing staged R2 JPEG '+item.id);
    // Firefox cancels decode() if an already-loading lazy <img> has both
    // crossOrigin and src changed; decode a fresh eager element before swapping.
    const replacement = new Image();
    for (const attr of img.attributes)
      if (!['src','srcset','crossorigin','loading'].includes(attr.name.toLowerCase()))
        replacement.setAttribute(attr.name, attr.value);
    replacement.crossOrigin = 'anonymous';
    replacement.loading = 'eager';
    replacement.src = target.url; // Only the ephemeral browser DOM changes.
    try { await replacement.decode(); }
    catch(e) { throw Error('R2 gallery JPEG decode '+item.id+' '+target.sourcePath+': '+e.message); }
    const portrait = item.orientation === 'portrait';
    if (replacement.naturalWidth !== (portrait ? 1000 : 1400) ||
        replacement.naturalHeight !== (portrait ? 1400 : 1000))
      throw Error('Replaced image has incorrect geometry '+item.id);
    img.replaceWith(replacement);
    result.push({id:item.id,legacySource:saved,legacyLink:remix.href,
                 newImageOrigin:new URL(replacement.src).origin,
                 width:replacement.naturalWidth,height:replacement.naturalHeight});
  }
  return result;
}"""


GPU_JS = r"""async assets => {
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});
  if(!gl)return {contextAvailable:false,texturesUploaded:0};
  let good=0;
  for(const item of assets) {
    const image=new Image();
    image.crossOrigin='anonymous';
    image.src=item.url;
    try { await image.decode(); }
    catch(e) { throw Error('R2 WebGL texture decode '+item.sourcePath+': '+e.message); }
    if(image.naturalWidth<100||image.naturalHeight<100)
      throw Error('Failed decode '+item.sourcePath);
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL texture upload error '+item.sourcePath);
    gl.deleteTexture(t);
    good++;
  }
  return {contextAvailable:true,texturesUploaded:good};
}"""


async def verify_browsers(m):
    from playwright.async_api import async_playwright
    edition = load_json(f"gallery/{DAY}/meta.json")
    entries = [{"id": e["id"], "imageFile": e["imageFile"],
                "shareUrl": e["shareUrl"], "orientation": e["orientation"]}
               for e in edition["entries"]]
    textures = [a for a in m["assets"] if a["role"] == "texture"]
    results = []
    async with async_playwright() as p:
        for name in ("chromium", "firefox", "webkit"):
            browser = await getattr(p, name).launch(headless=True, timeout=60000)
            try:
                page = await browser.new_page(viewport={"width": 1440, "height": 900})
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                response = await page.goto(ORIGIN + f"/algoart/gallery/{DAY}/",
                                           wait_until="domcontentloaded", timeout=60000)
                if response.status != 200:
                    raise ValueError("Actual published gallery unreachable in " + name)
                cards = await page.evaluate(GALLERY_JS, {"entries": entries, "assets": m["assets"]})
                if len(cards) != 16:
                    raise ValueError("Not all actual gallery artworks displayed from R2")
                gpu = await page.evaluate(GPU_JS, textures)
                if name in ("chromium", "webkit") and (not gpu["contextAvailable"] or
                                                          gpu["texturesUploaded"] != 32):
                    raise ValueError("GPU/WebGL 3D textures failed for " + name)
                if errors:
                    raise ValueError(name + " JavaScript error: " + errors[0])
                row = {"browser": name, "galleryCardsLoadedFromR2": len(cards),
                       "legacyRemixURLsUntouched": True,
                       "towerTexturesDecodedAndGPU": gpu["texturesUploaded"],
                       "gpuAvailable": gpu["contextAvailable"]}
                results.append(row)
                print("BROWSER PASS:", name, "gallery 16/16, tower WebGL",
                      gpu["texturesUploaded"], "/32 (GPU supported:",
                      gpu["contextAvailable"], ")")
            finally:
                await browser.close()
    return results


def verify():
    import asyncio
    prefix = scope()
    if not MANIFEST_PATH.exists():
        raise ValueError("Missing staging manifest")
    m = json.loads(MANIFEST_PATH.read_text("utf-8"))
    keys = manifest_keys(m, prefix)
    if len(keys) != 50:
        raise ValueError("Not a complete edition: refusal to verify")
    public = verify_public(m)
    results = asyncio.run(verify_browsers(m))
    report = {"day": DAY, "bucket": BUCKET, "objects": len(m["assets"]),
              "roles": EXPECTED, "publicHttpsVerified": len(public),
              "artworks": 16, "browsers": results,
              "productionFilesChanged": False,
              "privateBackupBucketAccessed": False,
              "testOnly": True,
              "limitations": ["Tests .r2.dev development URL, not a custom-domain CDN.",
                              "Gallery images swapped DOM-only on real published page; gallery files unchanged.",
                              "Tower textures decoded/uploaded to WebGL, not full physical Quest 3 tower rendering.",
                              "No original image, link, daily publisher or production R2 key is deleted or rewritten."]}
    write_json(REPORT_PATH, report)
    print("EDITION MIGRATION REHEARSAL PASS: 50 assets; gallery 16/16; 3 browsers")


def cleanup():
    prefix = scope()
    if not MANIFEST_PATH.exists():
        print("CLEANUP: no manifest, no objects owned by this run; no delete attempted")
        return
    m = json.loads(MANIFEST_PATH.read_text("utf-8"))
    keys = manifest_keys(m, prefix)
    if not keys:
        print("CLEANUP: empty manifest; no delete attempted")
        return
    c = client()
    # Never enumerate and delete wildcard matching keys; only the exact files
    # whose upload intentions were recorded by this specific run.
    for key in keys:
        c.delete_object(Bucket=BUCKET, Key=key)
    survivors = list_prefix(c, prefix)
    if survivors:
        raise ValueError("Unexpected keys remain in this run's prefix; NEVER delete non-manifest keys: "+str(len(survivors)))
    print("CLEANUP PASS: removed ONLY", len(keys), "manifested disposable files; unrelated media bucket objects untouched")


def self_test():
    assert BUCKET != PRIVATE_BUCKET
    assert KEY_ROOT.startswith("_release-a-")
    assets, edition, textures = source_files()
    assert len(assets) == 50 and len(edition["entries"]) == 16
    assert len(textures["images"]) == 16
    assert {a[2] for a in assets} == {"original", "texture", "cover", "sculptures"}
    for source, mime, *_ in assets:
        validate_source(source, mime, (SOURCE / source).read_bytes())
    print("SELF-TEST PASS: 50 exact sources, 16 images and 32 textures, no private archive access")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "self-test":
        self_test()
    elif command == "stage":
        stage()
    elif command == "verify":
        verify()
    elif command == "cleanup":
        cleanup()
    else:
        raise SystemExit("Use self-test, stage, verify or cleanup")
