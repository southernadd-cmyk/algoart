#!/usr/bin/env python3
"""Read-only inventory of PROPORTION PIECE's Cloudflare social-preview KV.

No KV mutations, no Worker deployment, no production/gallery change.
Requires a dedicated Cloudflare API token with Workers KV Storage Read.
Output REDACTS actual share tokens: only hashes and byte counts are recorded.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import tomllib
from urllib.parse import quote

def require(k):
    x=os.environ.get(k,"").strip()
    if not x:
        raise ValueError("Missing "+k+" (set in archive-r2-test environment secrets)")
    return x

def main():
    account=require("R2_ACCOUNT_ID")
    token=require("CF_KV_READ_TOKEN")
    if not re.fullmatch(r"[0-9a-fA-F]{32}",account):
        raise ValueError("Invalid Cloudflare account ID")
    with open("cloudflare/social-preview/wrangler.toml","rb") as f:
        conf=tomllib.load(f)
    namespaces=[x for x in conf.get("kv_namespaces",[]) if x.get("binding")=="PREVIEW_KV"]
    if len(namespaces)!=1:
        raise ValueError("PREVIEW_KV namespace binding missing or ambiguous")
    namespace=namespaces[0].get("id")
    if not re.fullmatch(r"[0-9a-fA-F]{32}",namespace or ""):
        raise ValueError("Invalid PREVIEW_KV namespace identifier")
    base="https://api.cloudflare.com/client/v4/accounts/"+account+"/storage/kv/namespaces/"+namespace
    import requests
    s=requests.Session()
    s.headers.update({"Authorization":"Bearer "+token,
                      "User-Agent":"proportion-piece-archive-readonly-kv-audit"})
    key_rows=[]
    cursor=None
    seen_cursors=set()
    for page in range(1,101):
        params={"prefix":"previews/","limit":1000}
        if cursor:
            params["cursor"]=cursor
        response=s.get(base+"/keys",params=params,timeout=(15,70))
        if response.status_code in (401,403):
            raise PermissionError("Workers KV Storage Read permission is missing or invalid")
        response.raise_for_status()
        payload=response.json()
        if not payload.get("success") or not isinstance(payload.get("result"),list):
            raise ValueError("Cloudflare KV list call did not succeed")
        for row in payload["result"]:
            name=row.get("name")
            if not isinstance(name,str) or not name.startswith("previews/") or \
                not name.endswith(".jpg"):
                raise ValueError("Unexpected KV key outside preview JPEG prefix")
            key_rows.append({
                "name":name,
                "nameSha256":hashlib.sha256(name.encode("utf8")).hexdigest(),
                "expiration":row.get("expiration"),
                "metadataPresent":row.get("metadata") is not None,
            })
        next_cursor=(payload.get("result_info") or {}).get("cursor")
        if not next_cursor:
            break
        if next_cursor in seen_cursors:
            raise ValueError("KV pagination cursor repeated")
        seen_cursors.add(next_cursor)
        cursor=next_cursor
    else:
        raise ValueError("KV key enumeration exceeded 100 pages")
    if len({r["name"] for r in key_rows})!=len(key_rows):
        raise ValueError("Duplicate KV key in pagination")
    count=0
    size=0
    anonymous=[]
    for i,row in enumerate(key_rows,1):
        name=row["name"]
        response=s.get(base+"/values/"+quote(name,safe=""),timeout=(15,50),stream=True)
        if response.status_code in (401,403):
            raise PermissionError("KV value read permission missing")
        response.raise_for_status()
        h=hashlib.sha256()
        bytes_count=0
        first=b""
        for chunk in response.iter_content(1024*128):
            if not chunk:
                continue
            if not first:
                first=chunk[:2]
            h.update(chunk)
            bytes_count+=len(chunk)
            if bytes_count>1024*1024:
                raise ValueError("KV JPEG unexpectedly exceeds 1 MiB")
        if bytes_count<4000 or first!=bytes.fromhex("ffd8"):
            raise ValueError("KV preview bytes are not a valid-sized JPEG")
        count+=1
        size+=bytes_count
        anonymous.append({
            "keyHash":row["nameSha256"],
            "valueSha256":h.hexdigest(),
            "bytes":bytes_count,
            "expiration":row["expiration"],
        })
        if i%100==0 or i==len(key_rows):
            print("Read-only KV preview verification:",i,"/",len(key_rows),flush=True)
    output={
        "schemaVersion":1,
        "status":"read-only-complete",
        "namespaceBinding":"PREVIEW_KV",
        "keyCount":count,
        "totalBytes":size,
        "actualShareTokensIncluded":False,
        "mediaBytesBackedUp":False,
        "notice":"Only counts and SHA-256 summaries; actual KV values were not backed up or changed.",
        "values":anonymous,
    }
    reportdir=Path(require("KV_REPORT_DIR"))
    reportdir.mkdir(parents=True,exist_ok=True)
    (reportdir/"kv-anonymised-inventory.json").write_text(
        json.dumps(output,sort_keys=True,indent=2)+"\n",encoding="utf8")
    print("KV READ-ONLY INVENTORY PASSED:",count,"previews",size,"bytes")
if __name__=="__main__":
    try:
        main()
    except Exception as e:
        print("KV audit blocked or failed:",type(e).__name__,
              str(e).splitlines()[0][:180],file=sys.stderr)
        sys.exit(1)
