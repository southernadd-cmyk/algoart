#!/usr/bin/env python3
"""Install the exact CC0 cast-iron lamp linked by the gallery author.

The GLB served by Innerscene is the Josh Dean / Poly Haven Street Lamp 01.
The source file's geometry is 3.87 m high and PBR materials are included.
"""
import json
import struct
import time
from pathlib import Path
from urllib.request import Request, urlopen

DOWNLOAD = "https://www.innerscene.com/api/library/cast-iron-street-lamp-53b9650f/download"
DEST = Path(__file__).resolve().parents[1] / "test/virtual-gallery/models/polyhaven-street-lamp-01.glb"

def validated_glb(data):
    if len(data)<1000 or len(data)>12_000_000 or data[:4]!=b"glTF":
        raise ValueError("Invalid cast-iron lamp GLB file")
    version,total=struct.unpack_from("<II",data,4)
    if version!=2 or total!=len(data):
        raise ValueError("Invalid glTF 2 binary header")
    chunk_size,chunk_type=struct.unpack_from("<I4s",data,12)
    if chunk_type!=b"JSON" or chunk_size<40 or 20+chunk_size>len(data):
        raise ValueError("GLB lacks valid JSON chunk")
    gltf=json.loads(data[20:20+chunk_size])
    if not gltf.get("meshes") or not gltf.get("materials"):
        raise ValueError("Street lamp mesh or materials absent")
    return gltf

def install():
    # The provider uses the same URL as its official Download GLB action.
    # A failed source fetch must fail the workflow, never publish HTML.
    for attempt in range(3):
        try:
            request=Request(DOWNLOAD,headers={"User-Agent":"Mozilla/5.0 (compatible; ProportionPieceGallery/1.0)"})
            with urlopen(request,timeout=45) as response:
                data=response.read(12_000_001)
            gltf=validated_glb(data)
            DEST.parent.mkdir(parents=True,exist_ok=True)
            DEST.write_bytes(data)
            print("Validated CC0 cast-iron street lamp:",len(data),"bytes;",
                  len(gltf["meshes"]),"meshes;",len(gltf["materials"]),"materials")
            return
        except Exception as exc:
            if attempt==2:raise RuntimeError("Could not install verified street lamp") from exc
            print("Asset fetch retry",attempt+1,":",exc)
            time.sleep(3)
if __name__=="__main__":
    install()
