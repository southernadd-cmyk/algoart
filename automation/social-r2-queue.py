#!/usr/bin/env python3
"""Freeze or restore reusable social artwork against verified immutable R2 images.

Only JSON queue manifests remain in GitHub Releases. All image bytes live in R2.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
from urllib.request import Request, build_opener

spec=importlib.util.spec_from_file_location("social_r2",Path(__file__).with_name("publish-social-r2.py"))
social=importlib.util.module_from_spec(spec)
spec.loader.exec_module(social)

def queue_files(queue):
    names=[]
    for item in queue["entries"]:
        for key in ("imageFile","instagramImageFile"):
            name=item.get(key)
            if name and name not in names:
                if Path(name).name!=name or not name.lower().endswith(".jpg") or ".." in name:
                    raise ValueError("Unsafe social filename "+name)
                names.append(name)
    if not names:raise ValueError("Empty reusable social queue")
    return names

def freeze(day,job,directory,dry_run=False):
    if not re.fullmatch(r"[a-z0-9-]{1,40}",job):raise ValueError("Invalid job key")
    queue_path=directory/"queue.json"
    queue=json.loads(queue_path.read_text())
    if queue.get("date")!=day:raise ValueError("Queue date mismatch")
    names=queue_files(queue)
    mapping={}
    client=None
    if not dry_run:
        client=social.connect_client()
    for index,name in enumerate(names):
        item=social.plan(day,f"{job}-{index}",directory/name)
        url=social.publish(item,dry_run=dry_run,client=client)
        mapping[name]={"url":url,"bytes":item["bytes"],"sha256":item["sha256"]}
    queue["r2Media"]=mapping
    if not dry_run:
        queue_path.write_text(json.dumps(queue,ensure_ascii=False,indent=2)+"\n")
    print("R2_SOCIAL_QUEUE_FROZEN "+json.dumps({"date":day,"job":job,
        "images":len(mapping),"dryRun":dry_run}))
    return mapping

def restore(day,directory,opener=None):
    queue=json.loads((directory/"queue.json").read_text())
    if queue.get("date")!=day:raise ValueError("Queue date mismatch")
    names=queue_files(queue)
    mapping=queue.get("r2Media")
    if not isinstance(mapping,dict) or set(mapping)!=set(names):
        raise ValueError("Incomplete R2 social queue")
    opener=opener or build_opener(social.media.NoRedirects())
    saved=[]
    for name in names:
        item=mapping[name]
        url=item["url"]
        sha=item["sha256"]
        if not re.fullmatch(r"[a-f0-9]{64}",sha) or not isinstance(item["bytes"],int) or item["bytes"]<1000:
            raise ValueError("Malformed frozen media digest")
        if not re.fullmatch(re.escape(social.media.WORKER+r"/editions/"+day+r"/social/")+r"[a-z0-9-]{1,64}-"+sha+r"\.jpg",url):
            raise ValueError("Untrusted frozen media URL")
        request=Request(url,headers={"User-Agent":"Mozilla/5.0"},method="GET")
        with opener.open(request,timeout=45) as response:
            if response.status!=200 or response.headers.get("Content-Type")!="image/jpeg":
                raise ValueError("Frozen image is not a JPEG")
            data=response.read(item["bytes"]+1)
        if len(data)!=item["bytes"] or hashlib.sha256(data).hexdigest()!=sha:
            raise ValueError("Frozen image checksum mismatch")
        target=directory/name
        # No partially successful restore should be treated as a ready queue.
        saved.append((target,data))
    for target,data in saved:
        target.write_bytes(data)
    print("R2_SOCIAL_QUEUE_RESTORED "+json.dumps({"date":day,"images":len(saved)}))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("command",choices=("freeze","restore"))
    p.add_argument("--date",required=True)
    p.add_argument("--directory",type=Path,required=True)
    p.add_argument("--job")
    p.add_argument("--dry-run",action="store_true")
    a=p.parse_args()
    if a.command=="freeze":
        if not a.job:raise ValueError("Freeze requires --job")
        freeze(a.date,a.job,a.directory,a.dry_run)
    else:
        if a.dry_run:raise ValueError("Restore uses the immutable public R2")
        restore(a.date,a.directory)
if __name__=="__main__":main()
