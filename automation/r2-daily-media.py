#!/usr/bin/env python3
"""Upload a staged daily edition, or verify both copies of a published edition."""
import argparse
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
from urllib.request import HTTPRedirectHandler, Request, build_opener

BUCKET = "proportion-piece-media-test"
WORKER = "https://proportion-piece-media.mr-adam-clement.workers.dev"
PAGES = "https://southernadd-cmyk.github.io"
CACHE_CONTROL = "public, max-age=31536000, immutable"
# Cloudflare error 1010 rejects the default Python-urllib user-agent. Keep
# public media reads browser-compatible without relaxing CORS or SHA checks.
PUBLIC_VERIFY_USER_AGENT = "Mozilla/5.0"
TYPES = {
    "original": ("jpg", "image/jpeg"),
    "desktop": ("webp", "image/webp"),
    "mobile": ("webp", "image/webp"),
    "cover": ("jpg", "image/jpeg"),
    "sculptures": ("json.gz", "application/gzip"),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def inspect_manifest(manifest_path, published, root, *, restoring=False):
    raw = manifest_path.read_bytes()
    manifest = json.loads(raw)
    check(manifest["schemaVersion"] == 2 and manifest["published"] is published and
          manifest["stageOnly"] is not published, "Unexpected publication manifest state")
    check(manifest["bucket"] == BUCKET and manifest["workerBase"] == WORKER,
          "Unexpected media destination")
    day = manifest["date"]
    check(date.fromisoformat(day).isoformat() == day and day >= "2026-11-09",
          "Invalid manifest edition date")
    edition = root / "gallery" / day
    meta = json.loads((edition / "meta.json").read_text())
    textures = json.loads((edition / "3d/manifest.json").read_text())
    entries = meta["entries"]
    count = 16 if day == "2026-11-09" else 14
    check(meta["date"] == day and manifest["count"] == meta["count"] == len(entries) == count,
          "Incomplete edition")
    fields = ("id", "shareUrl", "rendererVersion", "seed", "imageFile")
    check([{field: entry[field] for field in fields} for entry in entries] ==
          manifest["preservedShareUrls"], "Archived study identity or share state changed")
    entries_by_id = {entry["id"]: entry for entry in entries}
    check(len(entries_by_id) == count, "Duplicate artwork ID")
    check(textures["version"] == 1 and
          set(textures["images"]) == {entry["imageFile"] for entry in entries},
          "Texture manifest differs from the edition inventory")

    assets = manifest["mediaAssets"]
    keys = set()
    roles = set()
    for item in assets:
        role, artwork = item["role"], item["artworkId"]
        extension, content_type = TYPES[role]
        sha256 = item["sha256"]
        check(re.fullmatch(r"[a-f0-9]{64}", sha256), "Invalid media hash")
        asset_name = f"{role}-{sha256}.{extension}"
        if role in ("original", "desktop", "mobile"):
            entry = entries_by_id[artwork]
            check(re.fullmatch(r"[A-Za-z0-9_-]+", artwork) and
                  entry["imageFile"] == item["originalImageFile"], "Invalid artwork media identity")
            asset_name = f"{artwork}/{asset_name}"
            if published:
                check(entry["media"][role] == item["url"], "Published artwork URL differs")
                if role == "original":
                    check(entry["media"]["originalSha256"] == sha256 and
                          entry["media"]["originalBytes"] == item["bytes"],
                          "Published original checksum differs")
        else:
            check(artwork is None, "Unexpected artwork for edition-wide media")
            if published:
                check(meta["mediaCover" if role == "cover" else "mediaSculptures"] ==
                      item["url"], "Published edition URL differs")
        key = f"editions/{day}/{asset_name}"
        check(item["key"] == key and item["url"] == f"{WORKER}/{key}" and
              item["contentType"] == content_type and key not in keys and (artwork, role) not in roles,
              "Unexpected or duplicate media address")
        keys.add(key)
        roles.add((artwork, role))
        source = item["sourcePath"]
        check(re.fullmatch(rf"gallery/{day}/(?:3d/)?[A-Za-z0-9_.-]+", source)
              and ".." not in source, "Invalid media source path")
        if role in ("desktop", "mobile"):
            variant = textures["images"][item["originalImageFile"]][role]
            check(variant == (item["url"] if published else source.removeprefix(f"gallery/{day}/")),
                  "Texture manifest points at different media")
        else:
            name = {"original": item["originalImageFile"], "cover": "archive-preview.jpg",
                    "sculptures": "3d/sculptures.json.gz"}[role]
            check(source == f"gallery/{day}/{name}", "Unexpected Pages fallback path")
        local = root / source
        if not local.exists() and published and (restoring or manifest.get("pagesFallback") is False):
            continue
        data = local.read_bytes()
        check(len(data) == item["bytes"] and len(data) > 1000 and digest(data) == sha256,
              f"Pages fallback differs from the original: {source}")
    expected = {(artwork, role) for artwork in entries_by_id for role in
                ("original", "desktop", "mobile")} | {(None, "cover"), (None, "sculptures")}
    check(roles == expected, "Incomplete edition media inventory")
    return manifest, digest(raw)


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, url):
        return None


def verify_public(assets, opener=None, *, restore=None):
    opener = opener or build_opener(NoRedirects())
    for item in assets:
        for method in ("GET", "HEAD"):
            request = Request(item["url"], headers={"Origin": PAGES,
                                                    "User-Agent": PUBLIC_VERIFY_USER_AGENT},
                              method=method)
            with opener.open(request, timeout=40) as response:
                headers = response.headers
                check(response.status == 200 and headers.get("Content-Type") == item["contentType"] and
                      headers.get("Access-Control-Allow-Origin") == PAGES and
                      int(headers.get("Content-Length", "0")) == item["bytes"],
                      f"{method} metadata mismatch for {item['key']}")
                if method == "GET":
                    data = response.read(item["bytes"] + 1)
                    check(len(data) == item["bytes"] and digest(data) == item["sha256"],
                          f"Public bytes differ for {item['key']}")
        if restore is not None:
            target = restore / item["sourcePath"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)


def restore_assets(assets, directory, opener=None):
    scratch = Path(tempfile.mkdtemp(prefix="pp-r2-restore-", dir=directory))
    try:
        verify_public(assets, opener, restore=scratch)
    except Exception:
        shutil.rmtree(scratch)
        raise
    return scratch


def upload_assets(client, assets, root):
    from botocore.exceptions import ClientError

    client.head_bucket(Bucket=BUCKET)
    for item in assets:
        key = item["key"]
        data = (root / item["sourcePath"]).read_bytes()
        check(digest(data) == item["sha256"] and len(data) == item["bytes"],
              f"Staged source changed: {item['sourcePath']}")
        try:
            client.put_object(Bucket=BUCKET, Key=key, Body=data,
                              ContentType=item["contentType"], CacheControl=CACHE_CONTROL,
                              Metadata={"sha256": item["sha256"]}, IfNoneMatch="*")
        except ClientError as error:
            if error.response["ResponseMetadata"]["HTTPStatusCode"] != 412:
                raise
        stored = client.head_object(Bucket=BUCKET, Key=key)
        check(stored["ContentLength"] == item["bytes"] and
              stored["ContentType"] == item["contentType"] and
              stored["Metadata"].get("sha256") == item["sha256"],
              f"R2 object collision or incomplete write: {key}")


def media_client(day):
    import boto3
    from botocore.config import Config

    check(os.environ.get("GITHUB_REPOSITORY") == "southernadd-cmyk/algoart" and
          os.environ.get("GITHUB_REF") == "refs/heads/main" and
          os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and
          os.environ.get("PP_R2_CANARY_DATE") == day, "R2 write requires the armed main-branch canary")
    account = os.environ["R2_ACCOUNT_ID"]
    key = os.environ["R2_MEDIA_ACCESS_KEY_ID"]
    secret = os.environ["R2_MEDIA_SECRET_ACCESS_KEY"]
    check(re.fullmatch(r"[a-fA-F0-9]{32}", account) and key and secret,
          "Configure the scoped R2 media credentials")
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                        aws_access_key_id=key, aws_secret_access_key=secret,
                        region_name="auto", config=Config(
                            signature_version="s3v4", connect_timeout=15, read_timeout=40,
                            request_checksum_calculation="when_required",
                            s3={"addressing_style": "path"}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("upload", "recover", "restore"))
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--restore-to", type=Path)
    args = parser.parse_args()

    restoring = args.command == "restore"
    check(restoring == (args.restore_to is not None), "Restore requires a scratch parent directory")
    if restoring:
        check(not args.restore_to.resolve().is_relative_to(args.root.resolve()),
              "Restore directory must be outside the checkout")
    published = args.command != "upload"
    manifest, manifest_hash = inspect_manifest(args.manifest, published, args.root, restoring=restoring)
    if restoring:
        restored = restore_assets(manifest["mediaAssets"], args.restore_to)
    else:
        if not published:
            upload_assets(media_client(manifest["date"]), manifest["mediaAssets"], args.root)
        verify_public(manifest["mediaAssets"])
    report = {"date": manifest["date"], "manifestSha256": manifest_hash,
              "verified": len(manifest["mediaAssets"])}
    if not published:
        args.manifest.with_name("upload-verification.json").write_text(json.dumps(report) + "\n")
    if restoring:
        report["restoredTo"] = str(restored)
    print(json.dumps(report))


if __name__ == "__main__":
    main()
