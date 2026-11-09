#!/usr/bin/env python3
"""PROPORTION PIECE Release A: isolated, one-object R2 round-trip smoke test.

- Requires GitHub Actions environment "archive-r2-test".
- Restricts all operations to exactly one named *test* bucket and one unique key.
- Never reads or modifies the gallery or existing object keys.
- Tests put/head/get/SHA-256/delete; confirms deletion in all cases.
- No R2 secrets are printed. No credentials embedded in source.
"""
from __future__ import annotations

import hashlib
import io
import os
import re
import sys
from dataclasses import dataclass


BUCKET = "proportion-piece-archive-test"
REPOSITORY = "southernadd-cmyk/algoart"
BRANCH_REF = "refs/heads/plan/archive-storage-foundation-20261109"
MARKER = "Run isolated R2 smoke test 2026-11-09"


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"Required GitHub environment setting missing: {name}")
    return value


def smoke(client, bucket: str, key: str, body: bytes) -> None:
    if bucket != BUCKET:
        raise ValueError("Refusing to access any bucket except the isolated test bucket")
    if not re.fullmatch(r"_release-a-smoke/[0-9]+/[0-9]+/[a-z0-9-]+\.txt", key):
        raise ValueError("Refusing to write outside the smoke-test-only key prefix")

    expected = hashlib.sha256(body).hexdigest()
    put_attempted = False
    operation_failed = False
    try:
        # The key is unique to this workflow invocation; nothing existing is overwritten.
        put_attempted = True
        client.put_object(
            Bucket=bucket, Key=key, Body=body, ContentType="text/plain",
            CacheControl="no-store", Metadata={"sha256": expected},
        )
        print("PUT: OK")
        head = client.head_object(Bucket=bucket, Key=key)
        if int(head.get("ContentLength", -1)) != len(body):
            raise RuntimeError("HEAD: wrong object size")
        if head.get("Metadata", {}).get("sha256") != expected:
            raise RuntimeError("HEAD: expected SHA-256 metadata not found")
        print("HEAD: verified byte count and checksum metadata")

        result = client.get_object(Bucket=bucket, Key=key)
        downloaded = result["Body"].read()
        actual = hashlib.sha256(downloaded).hexdigest()
        if actual != expected or downloaded != body:
            raise RuntimeError("GET: downloaded bytes do not match SHA-256")
        print("GET: verified exact bytes and SHA-256")
    except Exception:
        operation_failed = True
        raise
    finally:
        if put_attempted:
            # Delete ONLY our uniquely named test object, even after a failed upload.
            try:
                client.delete_object(Bucket=bucket, Key=key)
                print("DELETE: requested test object cleanup")
                try:
                    client.head_object(Bucket=bucket, Key=key)
                except Exception as error:
                    code = getattr(error, "response", {}).get("Error", {}).get("Code")
                    if str(code) not in ("404", "NoSuchKey", "NotFound"):
                        raise
                    print("CLEANUP: object no longer exists")
                else:
                    raise RuntimeError("CLEANUP: test object still exists after deletion")
            except Exception:
                print("CLEANUP FAILED: manual inspection required for the specific test key", file=sys.stderr)
                # Never quietly claim success if the test object was not deleted.
                if not operation_failed:
                    raise


class FakeClient:
    """Network-free verification of exact-key put/get/delete semantics."""

    def __init__(self) -> None:
        self.objects = {}

    def put_object(self, *, Bucket, Key, Body, ContentType, CacheControl, Metadata):
        if (Bucket, Key) in self.objects:
            raise AssertionError("Unexpected overwrite in self-test")
        self.objects[(Bucket, Key)] = (Body, Metadata)

    def head_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            error = RuntimeError("404")
            error.response = {"Error": {"Code": "404"}}
            raise error
        data, metadata = self.objects[(Bucket, Key)]
        return {"ContentLength": len(data), "Metadata": metadata}

    def get_object(self, *, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)][0])}

    def delete_object(self, *, Bucket, Key):
        self.objects.pop((Bucket, Key), None)


def main():
    if sys.argv[1:] == ["--self-test"]:
        fake = FakeClient()
        smoke(fake, BUCKET, "_release-a-smoke/123/1/self-test.txt", b"local only\n")
        if fake.objects:
            raise RuntimeError("Self-test did not clear storage")
        print("SELF-TEST PASSED (no network calls)")
        return

    if sys.argv[1:]:
        raise ValueError("Only --self-test is accepted as an argument")
    if require("GITHUB_REPOSITORY") != REPOSITORY:
        raise ValueError("Unexpected GitHub repository")
    if require("GITHUB_REF") != BRANCH_REF:
        raise ValueError("Smoke test must run on the isolated branch")
    if require("GITHUB_EVENT_NAME") != "push":
        raise ValueError("Smoke test requires the explicit one-time push trigger")
    if require("R2_BUCKET") != BUCKET:
        raise ValueError("Incorrect R2 bucket; never access another bucket")

    account_id = require("R2_ACCOUNT_ID")
    if not re.fullmatch(r"[a-fA-F0-9]{32}", account_id):
        raise ValueError("R2_ACCOUNT_ID must be the 32-character Cloudflare account ID")
    access_key = require("R2_ACCESS_KEY_ID")
    secret_key = require("R2_SECRET_ACCESS_KEY")
    run_id = require("GITHUB_RUN_ID")
    attempt = require("GITHUB_RUN_ATTEMPT")
    if not run_id.isdecimal() or not attempt.isdecimal():
        raise ValueError("Invalid GitHub Actions run identifiers")

    # Keep the name predictable only for cleanup; the unique run+attempt pair
    # prevents accidental collisions with any prior test run.
    key = f"_release-a-smoke/{run_id}/{attempt}/round-trip.txt"
    body = (
        f"PROPORTION PIECE isolated R2 smoke test\n"
        f"repository={REPOSITORY}\nrun={run_id}\nattempt={attempt}\n"
    ).encode("utf-8")

    import boto3
    from botocore.config import Config

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        region_name="auto",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4", connect_timeout=15,
                      read_timeout=30, retries={"max_attempts": 2},
                      s3={"addressing_style": "path"}),
    )
    print("Target: isolated test bucket only; no gallery media access")
    print("Test key:", key)
    smoke(client, BUCKET, key, body)
    print("R2 ROUND-TRIP PASSED: upload/download/hash/cleanup verified")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("R2 smoke test failed:", type(exc).__name__, str(exc).splitlines()[0][:250],
              file=sys.stderr)
        sys.exit(1)
