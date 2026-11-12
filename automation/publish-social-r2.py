#!/usr/bin/env python3
"""Publish immutable JPEG social derivatives to the existing edition media R2 Worker.

No GitHub Releases artwork writes. GET and HEAD must verify before URL is output.
Use --dry-run for offline validation; write operations only on main for published R2-only editions.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location("pp_r2_media",ROOT/"automation/r2-daily-media.py")
media=importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)

def plan(day,role,source,archive=ROOT/"gallery"):
    media.check(bool(re.fullmatch(r"20\d{2}-\d{2}-\d{2}",day)), "Invalid edition date")
    media.check(bool(re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}",role)), "Invalid social derivative role")
    receipt=archive/day/"media-publication.json"
    media.check(receipt.is_file(),"Missing published edition receipt")
    m=json.loads(receipt.read_text())
    media.check(m.get("date")==day and m.get("published") is True and
                m.get("stageOnly") is False and m.get("pagesFallback") is False and
                m.get("workerBase")==media.WORKER,
                "Social R2 write requires published artwork-only edition")
    data=source.read_bytes()
    media.check(1000<len(data)<20*1024*1024 and data[:2]==b"\xff\xd8",
                "Social derivative must be a nonempty JPEG")
    sha=hashlib.sha256(data).hexdigest()
    key=f"editions/{day}/social/{role}-{sha}.jpg"
    return {"key":key,"url":media.WORKER+"/"+key,"data":data,"bytes":len(data),
            "sha256":sha,"contentType":"image/jpeg","sourcePath":str(source)}

def publish(item,dry_run=False,client=None):
    if dry_run:return item["url"]
    media.check(os.environ.get("GITHUB_REPOSITORY")=="southernadd-cmyk/algoart" and
                os.environ.get("GITHUB_REF")=="refs/heads/main" and
                os.environ.get("R2_SOCIAL_ART_ONLY")=="true",
                "No R2 social writes outside authorized main workflow")
    media.check(client is not None,"Cloud client required")
    from botocore.exceptions import ClientError
    try:
        client.put_object(Bucket=media.BUCKET,Key=item["key"],Body=item["data"],
            ContentType=item["contentType"],CacheControl=media.CACHE_CONTROL,
            Metadata={"sha256":item["sha256"]},IfNoneMatch="*")
    except ClientError as error:
        if error.response.get("ResponseMetadata",{}).get("HTTPStatusCode")!=412:
            raise
    stored=client.head_object(Bucket=media.BUCKET,Key=item["key"])
    media.check(stored["ContentLength"]==item["bytes"] and
                stored["ContentType"]==item["contentType"] and
                stored["Metadata"].get("sha256")==item["sha256"],
                "Social R2 object collision or corrupted upload")
    media.verify_public([item])
    return item["url"]

def connect_client():
    import boto3
    from botocore.config import Config
    media.check(os.environ.get("GITHUB_REPOSITORY")=="southernadd-cmyk/algoart" and
                os.environ.get("GITHUB_REF")=="refs/heads/main" and
                os.environ.get("R2_SOCIAL_ART_ONLY")=="true",
                "Unauthorized social storage upload")
    account=os.environ["R2_ACCOUNT_ID"]
    media.check(bool(re.fullmatch(r"[a-fA-F0-9]{32}",account)),"Invalid R2 account")
    return boto3.client("s3",endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_MEDIA_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_MEDIA_SECRET_ACCESS_KEY"],
        region_name="auto",config=Config(signature_version="s3v4",
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
            s3={"addressing_style":"path"}))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--date",required=True)
    p.add_argument("--role",required=True)
    p.add_argument("--file",required=True,type=Path)
    p.add_argument("--dry-run",action="store_true")
    a=p.parse_args()
    item=plan(a.date,a.role,a.file)
    client=connect_client() if not a.dry_run else None
    url=publish(item,dry_run=a.dry_run,client=client)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"],"a") as output:
            output.write("media_url="+url+"\n")
    print("R2_SOCIAL_MEDIA_OK "+json.dumps({"date":a.date,"role":a.role,
        "dryRun":a.dry_run,"bytes":item["bytes"],"sha256":item["sha256"],"url":url}))

if __name__=="__main__":
    main()
