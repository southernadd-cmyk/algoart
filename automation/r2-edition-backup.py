#!/usr/bin/env python3
"""Exact-byte, independent gallery-media backup and guarded missing-object recovery.

No scheduled writes. Backup ZIPs live outside Git and R2; the operator must
preserve them beyond GitHub Actions artifact retention for long-term recovery.
"""
import argparse
from contextlib import closing
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import zipfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pp_r2_daily", HERE / "r2-daily-media.py")
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)
MANIFEST_ENTRY = "stage-manifest.json"


def require(ok, message):
    if not ok:
        raise ValueError(message)


def identity(manifest):
    return {
        "date": manifest["date"], "bucket": manifest["bucket"],
        "workerBase": manifest["workerBase"], "count": manifest["count"],
        "preservedShareUrls": manifest["preservedShareUrls"],
        "mediaAssets": manifest["mediaAssets"],
    }


def inventory(manifest):
    require(manifest.get("pagesFallback") is False and
            manifest.get("bucket") == media.BUCKET and
            manifest.get("workerBase") == media.WORKER,
            "Only verified R2-only editions can use independent recovery")
    result = {}
    for item in manifest["mediaAssets"]:
        path = item["sourcePath"]
        require(path not in result and
                bool(re.fullmatch(r"gallery/20\d{2}-\d{2}-\d{2}/(?:3d/)?[-\w.]+", path)) and
                ".." not in path and path.startswith("gallery/" + manifest["date"] + "/") and
                bool(re.fullmatch(r"[a-f0-9]{64}", item["sha256"])) and
                1000 < item["bytes"] < 100_000_000,
                "Invalid or duplicate backup media path")
        result[path] = item
    require(len(result) == manifest["count"] * 3 + 1,
            "Incomplete independent artwork inventory")
    return result


def make_bundle(manifest_path, root, output):
    root = root.resolve()
    output = output.resolve()
    require(not output.is_relative_to(root), "Backup must be outside the checkout")
    manifest, _ = media.inspect_manifest(manifest_path, False, root)
    require(manifest.get("stageOnly") is True and manifest.get("published") is False,
            "Backup must use the fully verified pre-publication inventory")
    assets = inventory(manifest)
    raw = manifest_path.read_bytes()
    verified = {}
    for path, item in assets.items():
        content = (root / path).read_bytes()
        require(len(content) == item["bytes"] and
                hashlib.sha256(content).hexdigest() == item["sha256"],
                "Backup source checksum differs: " + path)
        verified[path] = content
    output.parent.mkdir(parents=True, exist_ok=True)
    scratch = output.with_name(output.name + ".part")
    try:
        with zipfile.ZipFile(scratch, "w", compression=zipfile.ZIP_STORED,
                             allowZip64=True) as archive:
            archive.writestr(MANIFEST_ENTRY, raw)
            for path in sorted(verified):
                archive.writestr(path, verified[path])
        # Never advertise an archive whose ZIP or individual objects are invalid.
        load_bundle(scratch, manifest)
        scratch.replace(output)
    finally:
        scratch.unlink(missing_ok=True)
    return {"backup": str(output), "sha256": media.digest(output.read_bytes()),
            "date": manifest["date"], "assets": len(verified)}


def load_bundle(archive_path, receipt):
    assets = inventory(receipt)
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        names = [m.filename for m in members]
        require(len(names) == len(set(names)) and
                set(names) == set(assets) | {MANIFEST_ENTRY},
                "Backup contains unexpected, missing, or duplicate files")
        raw = archive.read(MANIFEST_ENTRY)
        require(len(raw) < 1_000_000, "Oversized backup manifest")
        saved = json.loads(raw)
        require(saved.get("stageOnly") is True and saved.get("published") is False and
                saved.get("pagesFallback") is False and
                identity(saved) == identity(receipt),
                "Backup does not match the exact published edition")
        saved_assets = inventory(saved)
        require(set(saved_assets) == set(assets), "Backup inventory mismatch")
        data = {}
        for member in members:
            if member.filename == MANIFEST_ENTRY:
                continue
            item = assets[member.filename]
            require(member.is_dir() is False and member.file_size == item["bytes"] and
                    member.compress_size <= item["bytes"] * 2,
                    "Unsafe or incorrect media entry in backup")
            content = archive.read(member)
            require(len(content) == item["bytes"] and
                    media.digest(content) == item["sha256"],
                    "Backup media SHA-256 mismatch: " + member.filename)
            data[member.filename] = content
    return data


def verify_receipt(path, root):
    manifest, _ = media.inspect_manifest(path, True, root, restoring=True)
    require(manifest.get("published") is True and
            manifest.get("stageOnly") is False, "Published R2-only receipt required")
    inventory(manifest)
    return manifest


def restore_local(archive_path, receipt, parent):
    data = load_bundle(archive_path, receipt)
    parent.mkdir(parents=True, exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix="pp-r2-exact-restore-", dir=parent))
    try:
        for path, content in data.items():
            target = folder / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
    except Exception:
        shutil.rmtree(folder)
        raise
    return folder


def remote_bytes(client, key):
    from botocore.exceptions import ClientError
    try:
        response = client.get_object(Bucket=media.BUCKET, Key=key)
    except ClientError as error:
        if str(error.response.get("Error", {}).get("Code")) in ("NoSuchKey", "404", "NotFound"):
            return None
        raise
    stream = response["Body"]
    try:
        return stream.read()
    finally:
        stream.close()


def repair_missing(client, receipt, data):
    assets = inventory(receipt)
    # Inspect the WHOLE edition before any write. Existing corrupt objects are
    # deliberately not overwritten or deleted, even if another key is missing.
    missing = []
    for path, item in assets.items():
        original = remote_bytes(client, item["key"])
        if original is None:
            missing.append(item)
        else:
            require(len(original) == item["bytes"] and
                    media.digest(original) == item["sha256"],
                    "Existing R2 object is corrupt; refusing unsafe overwrite: " + item["key"])
    for item in missing:
        original = data[item["sourcePath"]]
        client.put_object(Bucket=media.BUCKET, Key=item["key"],
                          Body=original, ContentType=item["contentType"],
                          CacheControl=media.CACHE_CONTROL,
                          Metadata={"sha256": item["sha256"]}, IfNoneMatch="*")
        stored = remote_bytes(client, item["key"])
        require(stored is not None and len(stored) == item["bytes"] and
                media.digest(stored) == item["sha256"],
                "Repaired R2 bytes failed read-back: " + item["key"])
        media.verify_public([item])
    return {"assets": len(assets), "restoredMissing": len(missing),
            "existingVerified": len(assets) - len(missing)}


def connect_for_repair(date, run_id):
    require(os.environ.get("GITHUB_REPOSITORY") == "southernadd-cmyk/algoart" and
            os.environ.get("GITHUB_REF") == "refs/heads/main" and
            os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and
            os.environ.get("R2_REPAIR_DATE") == date and
            os.environ.get("R2_REPAIR_RUN_ID") == run_id and
            bool(re.fullmatch(r"[0-9]+", run_id)),
            "Missing-object repairs require the explicitly dated manual main-branch workflow")
    from botocore.config import Config
    import boto3
    account = os.environ["R2_ACCOUNT_ID"]
    require(bool(re.fullmatch(r"[a-fA-F0-9]{32}", account)), "Invalid R2 account")
    return boto3.client("s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_MEDIA_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_MEDIA_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4",
                      request_checksum_calculation="when_required",
                      response_checksum_validation="when_required",
                      s3={"addressing_style": "path"}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--manifest", type=Path, required=True)
    create.add_argument("--output", type=Path, required=True)
    for name in ("verify", "restore", "repair"):
        command = commands.add_parser(name)
        command.add_argument("--receipt", type=Path, required=True)
        command.add_argument("--archive", type=Path, required=True)
        if name == "restore":
            command.add_argument("--to", type=Path, required=True)
        if name == "repair":
            command.add_argument("--run-id", required=True)
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    if args.command == "create":
        report = make_bundle(args.manifest, args.root, args.output)
    else:
        receipt = verify_receipt(args.receipt, args.root)
        data = load_bundle(args.archive, receipt)
        if args.command == "restore":
            require(not args.to.resolve().is_relative_to(args.root.resolve()),
                    "Restored media must remain outside the checkout")
            folder = restore_local(args.archive, receipt, args.to)
            report = {"restoredTo": str(folder), "assets": len(data)}
        elif args.command == "repair":
            client = connect_for_repair(receipt["date"], args.run_id)
            report = repair_missing(client, receipt, data)
        else:
            report = {"verified": len(data), "date": receipt["date"]}
    print("R2_EXACT_BACKUP_OK " + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
