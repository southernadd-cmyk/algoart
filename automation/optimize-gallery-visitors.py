#!/usr/bin/env python3
"""Make a smaller visitor GLB without changing mesh, rig or animation data.
Writes a *separate* asset; the live gallery stays on its existing model.
Requires Pillow. Usage: python3 automation/optimize-gallery-visitors.py
"""
from pathlib import Path
from io import BytesIO
import copy
import json
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "test/virtual-gallery/models"
SOURCE = ROOT / "human-male-female-rigged.glb"
TARGET = Path(__file__).resolve().parents[1] / "gallery/visit/models/human-male-female-rigged-optimized.glb"

def read_glb(path):
    payload = path.read_bytes()
    if payload[:4] != b"glTF" or struct.unpack_from("<II", payload, 4) != (2, len(payload)):
        raise ValueError("Not a valid GLB")
    size, kind = struct.unpack_from("<I4s", payload, 12)
    if kind != b"JSON":
        raise ValueError("GLB JSON missing")
    doc = json.loads(payload[20:20+size])
    start = 20+size
    length, kind = struct.unpack_from("<I4s", payload, start)
    if kind != b"BIN\\x00".replace(b"\\x00", b"\x00"):
        raise ValueError("GLB BIN missing")
    binary = payload[start+8:start+8+length]
    if len(binary) != length:
        raise ValueError("Truncated GLB BIN")
    return payload, doc, binary

raw, original, binary = read_glb(SOURCE)
doc = copy.deepcopy(original)
image_views = {}
for i, entry in enumerate(doc.get("images", [])):
    if "bufferView" not in entry:
        continue
    idx = entry["bufferView"]
    view = original["bufferViews"][idx]
    chunk = binary[view.get("byteOffset", 0):view.get("byteOffset", 0)+view["byteLength"]]
    with Image.open(BytesIO(chunk)) as pic:
        alpha = "A" in pic.getbands() or "transparency" in pic.info
        pic.thumbnail((768, 768), Image.Resampling.LANCZOS)
        out = BytesIO()
        if alpha:
            pic.convert("RGBA").save(out, format="PNG", optimize=True)
            mimetype = "image/png"
        else:
            pic.convert("RGB").save(out, format="JPEG", quality=76, optimize=True)
            mimetype = "image/jpeg"
    encoded = out.getvalue()
    if len(encoded) < len(chunk):
        image_views[idx] = encoded
        doc["images"][i]["mimeType"] = mimetype

rebuilt = bytearray()
for index, view in enumerate(doc.get("bufferViews", [])):
    old = original["bufferViews"][index]
    start = old.get("byteOffset", 0)
    data = image_views.get(index, binary[start:start+old["byteLength"]])
    rebuilt.extend(b"\x00" * ((-len(rebuilt)) % 4))
    view["byteOffset"] = len(rebuilt)
    view["byteLength"] = len(data)
    rebuilt.extend(data)
rebuilt.extend(b"\x00" * ((-len(rebuilt)) % 4))
doc["buffers"][0]["byteLength"] = len(rebuilt)
metadata = json.dumps(doc, separators=(",", ":")).encode("utf8")
metadata += b" " * ((-len(metadata)) % 4)
result = (
    struct.pack("<4sII", b"glTF", 2, 12+8+len(metadata)+8+len(rebuilt))
    + struct.pack("<I4s", len(metadata), b"JSON") + metadata
    + struct.pack("<I4s", len(rebuilt), b"BIN\x00") + rebuilt
)
if len(result) >= len(raw):
    raise ValueError("No reduction: keeping existing visitor GLB")
TARGET.write_bytes(result)
_, check, packed = read_glb(TARGET)
for key in ("nodes", "meshes", "skins", "animations", "accessors", "materials"):
    if check.get(key) != original.get(key):
        raise ValueError("Visitor "+key+" unexpectedly modified")
for idx, view in enumerate(original["bufferViews"]):
    if idx in image_views:
        continue
    before = binary[view.get("byteOffset", 0):view.get("byteOffset", 0)+view["byteLength"]]
    after_view = check["bufferViews"][idx]
    after = packed[after_view["byteOffset"]:after_view["byteOffset"]+after_view["byteLength"]]
    if before != after:
        raise ValueError("Rig/mesh buffer view changed: "+str(idx))
print(f"Visitor asset: {len(raw):,} -> {len(result):,} bytes ({100*(1-len(result)/len(raw)):.1f}% smaller); {len(image_views)} textures recompressed")
