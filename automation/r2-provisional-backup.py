#!/usr/bin/env python3
"""Release A — one-time provisional off-GitHub snapshot with full restore proof.

Source: a clean, read-only checkout of GitHub main.
Destination: private Cloudflare R2 test bucket, immutable content-addressed key.
Includes all tracked files at HEAD (software, gallery media, dated archives).
Does NOT include Git history, external GitHub Release assets, or Workers KV.

The snapshot is retained, unlike the temporary edition smoke-test objects.
It is provisional: NOT a final independent disaster-recovery backup for a
future production archive also hosted in the same Cloudflare account.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import tempfile


REPO = "southernadd-cmyk/algoart"
REF = "refs/heads/plan/archive-storage-foundation-20261109"
BUCKET = "proportion-piece-archive-test"
SNAPSHOT_PREFIX = "_release-a-provisional-backup/repository-main/"


def require(name):
    s = os.environ.get(name, "").strip()
    if not s:
        raise ValueError("Missing environment setting: " + name)
    return s


def file_hash(file):
    h = sha256()
    with open(file, "rb") as f:
        for b in iter(lambda: f.read(2 * 1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def safe_rel(name):
    if not isinstance(name, str) or not name or "\\" in name:
        raise ValueError("Invalid tracked source path")
    x = PurePosixPath(name)
    if x.is_absolute() or ".." in x.parts or x.as_posix() != name:
        raise ValueError("Unsafe tracked path: " + name)
    return name


def source_tree(root):
    paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode(
        "utf8").split("\0")
    paths = sorted(p for p in paths if p)
    records = []
    for p in paths:
        safe_rel(p)
        full = root / p
        if not full.is_file() or full.is_symlink():
            raise ValueError("Tracked file missing or symbolic link: " + p)
        records.append({
            "path": p,
            "bytes": full.stat().st_size,
            "sha256": file_hash(full),
        })
    if not records or not any(x["path"].startswith("gallery/2026-11-09/") for x in records):
        raise ValueError("Snapshot does not contain the completed edition")
    return records


def build_tar(root, records, output):
    with tarfile.open(output, "w:gz", compresslevel=3) as tar:
        for x in records:
            name = x["path"]
            full = root / name
            entry = tar.gettarinfo(str(full), arcname=name)
            if not entry.isfile():
                raise ValueError("Only normal tracked files supported: " + name)
            entry.uid = entry.gid = 0
            entry.uname = entry.gname = ""
            entry.mtime = 0
            with full.open("rb") as f:
                tar.addfile(entry, f)


def verify_and_restore(file, target, records):
    expected = {x["path"]: x for x in records}
    seen = set()
    with tarfile.open(file, "r:gz") as tar:
        for member in tar:
            name = safe_rel(member.name)
            if not member.isfile() or name in seen or name not in expected:
                raise ValueError("Unexpected or duplicated tar entry: " + name)
            seen.add(name)
            dest = target.joinpath(*PurePosixPath(name).parts)
            dest.parent.mkdir(parents=True, exist_ok=True)
            s = tar.extractfile(member)
            if s is None:
                raise ValueError("Cannot restore tar file: " + name)
            with dest.open("wb") as out:
                while True:
                    chunk = s.read(2 * 1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            if dest.stat().st_size != expected[name]["bytes"] or \
               file_hash(dest) != expected[name]["sha256"]:
                raise ValueError("Restored byte mismatch for " + name)
    if seen != set(expected):
        missing = sorted(set(expected) - seen)
        raise ValueError("Snapshot missing files: " + ", ".join(missing[:5]))
    return len(seen)


def new_client():
    import boto3
    from botocore.config import Config

    account = require("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
        raise ValueError("Cloudflare account ID malformed")
    return boto3.client(
        "s3",
        endpoint_url="https://" + account + ".r2.cloudflarestorage.com",
        region_name="auto",
        aws_access_key_id=require("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=require("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4", connect_timeout=20,
                      read_timeout=60, retries={"max_attempts": 3},
                      s3={"addressing_style": "path"}),
    )


def is_missing(e):
    return str(getattr(e, "response", {}).get("Error", {}).get("Code")) in (
        "404", "NoSuchKey", "NotFound"
    )


def check_existing_or_upload(client, key, data, expected_sha, content_type, source_commit):
    if not key.startswith(SNAPSHOT_PREFIX) or source_commit not in key:
        raise ValueError("Refusing to write outside immutable release A snapshot path")
    n = data.stat().st_size if isinstance(data, Path) else len(data)
    try:
        head = client.head_object(Bucket=BUCKET, Key=key)
    except Exception as e:
        if not is_missing(e):
            raise
    else:
        if head.get("ContentLength") != n or \
           head.get("Metadata", {}).get("sha256") != expected_sha:
            raise ValueError("Backup object collision or damaged metadata: " + key)
        print("Existing immutable backup object matches size and digest metadata.")
        return False

    extra = {
        "ContentType": content_type,
        "CacheControl": "private, no-store",
        "Metadata": {"sha256": expected_sha, "sourcecommit": source_commit},
    }
    if isinstance(data, Path):
        from boto3.s3.transfer import TransferConfig
        client.upload_file(
            str(data), BUCKET, key,
            ExtraArgs=extra,
            Config=TransferConfig(multipart_threshold=32 * 1024 * 1024,
                                  multipart_chunksize=16 * 1024 * 1024,
                                  max_concurrency=6),
        )
    else:
        client.put_object(Bucket=BUCKET, Key=key, Body=data,
                          ContentType=content_type, CacheControl="private, no-store",
                          Metadata=extra["Metadata"])
    head = client.head_object(Bucket=BUCKET, Key=key)
    if head.get("ContentLength") != n or \
       head.get("Metadata", {}).get("sha256") != expected_sha:
        raise ValueError("Uploaded backup head not verified: " + key)
    return True


def main():
    if require("GITHUB_REPOSITORY") != REPO or require("GITHUB_REF") != REF or \
       require("GITHUB_EVENT_NAME") != "push":
        raise ValueError("This backup may run only on the isolated planning branch")
    if require("R2_BUCKET") != BUCKET:
        raise ValueError("Refusing non-test bucket")
    source = Path("live-snapshot").resolve()
    if not (source / ".git").exists():
        raise ValueError("Missing separate GitHub main checkout")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                     cwd=source, text=True).strip()
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Invalid GitHub commit")
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=source).strip():
        raise ValueError("Source is not a clean published checkout")
    report_dir = Path(require("R2_BACKUP_REPORT_DIR")).resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    records = source_tree(source)
    size = sum(x["bytes"] for x in records)
    print("Published Git source snapshot:", commit)
    print("Files:", len(records), "source bytes:", size)
    # Do not write backup ZIPs or manifest to the production repo.
    with tempfile.TemporaryDirectory(prefix="pp-backup-scratch-") as td:
        temp = Path(td)
        bundle = temp / "repository.tar.gz"
        build_tar(source, records, bundle)
        digest = file_hash(bundle)
        bytes_count = bundle.stat().st_size
        key = SNAPSHOT_PREFIX + commit + "/" + digest + ".tar.gz"
        if not re.fullmatch(re.escape(SNAPSHOT_PREFIX) + r"[a-f0-9]{40}/[a-f0-9]{64}\.tar\.gz",key):
            raise ValueError("Refusing unsafe backup object key")

        manifest = {
            "schemaVersion": 1,
            "description": "Provisional external recovery snapshot; not complete offsite policy",
            "repository": REPO,
            "sourceCommit": commit,
            "archive": {"key": key, "sha256": digest, "bytes": bytes_count,
                        "format": "tar+gzip", "includesGitHistory": False},
            "trackedFiles": len(records),
            "trackedBytes": size,
            "files": records,
            "excludedExternalSources": [
                "GitHub Release assets not mirrored in the tree",
                "Cloudflare Workers KV social-preview records",
                "Git commit history prior to sourceCommit",
                "GitHub repository and account settings/secrets",
            ],
            "notIndependentFromFutureCloudflareProductionStorage": True,
            "productionUnchanged": True,
        }
        manifest_bytes = (json.dumps(manifest, sort_keys=True,
                                     separators=(",",":")) + "\n").encode("utf8")
        manifest_digest = sha256(manifest_bytes).hexdigest()
        manifest_key = SNAPSHOT_PREFIX + commit + "/" + digest + "/manifest.json"

        client = new_client()
        created = check_existing_or_upload(client,key,bundle,digest,
                                           "application/gzip",commit)
        print("Provisional R2 backup archive:", "new" if created else "already present",
              "bytes:",bytes_count)

        # Read-back into a new empty location, not into the source checkout.
        downloaded = temp / "r2-downloaded.tar.gz"
        client.download_file(BUCKET, key, str(downloaded))
        if downloaded.stat().st_size != bytes_count or file_hash(downloaded) != digest:
            raise ValueError("Remote backup download does not match archived bytes")

        restored = temp / "restored"
        restored.mkdir()
        restored_count = verify_and_restore(downloaded,restored,records)
        print("Independent restoration from R2:",restored_count,
              "files with byte-exact SHA-256 PASS")

        # Validate that the full 2026-11-09 gallery survives extraction.
        spec = importlib.util.spec_from_file_location(
            "edition_validator", Path("automation/r2-edition-restore-test.py").resolve()
        )
        if not spec or not spec.loader:
            raise ValueError("Missing edition integrity validator")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        date_files = [x["path"] for x in records if x["path"].startswith("gallery/2026-11-09/")]
        edition = module.validate_edition(restored,date_files)
        if edition["originals"] != 16 or edition["confluence"] != 4 or \
           edition["variants"] != 32:
            raise ValueError("Restored dated exhibition incomplete")

        # Only write the verified manifest after a complete restore passes.
        check_existing_or_upload(client,manifest_key,manifest_bytes,manifest_digest,
                                 "application/json",commit)
        returned_manifest = client.get_object(Bucket=BUCKET,Key=manifest_key)["Body"].read()
        if returned_manifest != manifest_bytes:
            raise ValueError("Manifest cannot be recovered with exact bytes")
        report = {
            "status":"passed",
            "snapshotScope":"entire tracked HEAD tree, no Git history or external assets",
            "sourceCommit":commit,
            "bucket":BUCKET,
            "objectKey":key,
            "manifestKey":manifest_key,
            "backupArchiveBytes":bytes_count,
            "backupArchiveSHA256":digest,
            "trackedFiles":len(records),
            "sourceBytes":size,
            "restoredFiles":restored_count,
            "restoredBytesExact":True,
            "restoredConfluence":edition["confluence"],
            "restoredSolo":edition["solo"],
            "restoredTextures":edition["variants"],
            "restoredPortraits":edition["portraits"],
            "timestamp":datetime.now(timezone.utc).isoformat(),
            "isProvisional":True,
            "notFinalIndependentDisasterRecovery":True,
            "requiresSeparateProviderBeforeCloudflareIsPrimary":True,
        }
        (report_dir / "provisional-backup-restore-report.json").write_text(
            json.dumps(report,indent=2)+"\n",encoding="utf8")
        (report_dir / "backup-manifest.json").write_bytes(manifest_bytes)
        (report_dir / "README.txt").write_text(
            "R2 snapshot retained in test bucket, not yet production storage.\n"
            "Restoration checked all tracked source bytes and the complete 16-artwork exhibition.\n"
            "This snapshot EXCLUDES GitHub Release assets, full Git history and Cloudflare KV.\n"
            "Before R2 becomes production, a separate provider/account backup is required.\n",
            encoding="utf8")
        print("PROVISIONAL R2 SNAPSHOT AND RESTORE VERIFICATION PASSED")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never expose credentials, account ID, endpoint or raw HTTP headers.
        print("Provisional backup test failed:",type(error).__name__,
              str(error).splitlines()[0][:180],file=sys.stderr)
        sys.exit(1)
