#!/usr/bin/env python3
"""Build eyes-only, vertex-coloured Quaternius GLBs from public CC0 source.
Source: NafisRayan/Animate-Rigged-Humanoid-No-Blender mirror of Quaternius Universal Base Characters.
Does not touch the gallery runtime.
"""
import copy,io,json,struct,urllib.request,urllib.parse
from pathlib import Path
from PIL import Image

BASE="https://raw.githubusercontent.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender/main/Universal%20Base%20Characters%5BStandard%5D/Universal%20Base%20Characters%5BStandard%5D/Base%20Characters/Godot%20-%20UE/"
OUT=Path("test/virtual-gallery/models")
OUT.mkdir(parents=True,exist_ok=True)

def download(name):
    with urllib.request.urlopen(BASE+urllib.parse.quote(name),timeout=45) as res:
        return res.read()

def make(gender):
    tag=gender.capitalize()
    doc=json.loads(download(f"Superhero_{tag}_FullBody.gltf"))
    raw=download(f"Superhero_{tag}_FullBody.bin")
    binary=bytearray(raw)
    def append(chunk):
        binary.extend(b"\0"*(-len(binary)%4))
        offset=len(binary)
        binary.extend(chunk)
        return offset
    def accessor(idx):
        acc=doc["accessors"][idx]
        view=doc["bufferViews"][acc["bufferView"]]
        n={"VEC2":2,"VEC3":3,"VEC4":4}[acc["type"]]
        fmt="<"+({5126:"f",5123:"H",5121:"B"}[acc["componentType"]]*n)
        off=view.get("byteOffset",0)+acc.get("byteOffset",0)
        step=view.get("byteStride",struct.calcsize(fmt))
        return [struct.unpack_from(fmt,raw,off+i*step) for i in range(acc["count"])]
    body=doc["materials"][2]["pbrMetallicRoughness"]
    picture_index=doc["textures"][body["baseColorTexture"]["index"]]["source"]
    picture_name=doc["images"][picture_index]["uri"]
    source=Image.open(io.BytesIO(download(picture_name))).convert("RGB")
    palette=source.quantize(colors=24,method=Image.Quantize.MEDIANCUT).convert("RGB")
    w,h=palette.size
    coloured=0
    for mesh in doc["meshes"]:
        for prim in mesh["primitives"]:
            if prim.get("material")!=2:continue
            uvs=accessor(prim["attributes"]["TEXCOORD_0"])
            pixels=bytearray()
            for u,v in uvs:
                x=round((u%1)*(w-1)); y=round(((1-v)%1)*(h-1))
                pixels.extend((*palette.getpixel((x,y)),255))
            offset=append(pixels)
            vi=len(doc["bufferViews"])
            doc["bufferViews"].append({"buffer":0,"byteOffset":offset,"byteLength":len(pixels),"target":34962})
            ai=len(doc["accessors"])
            doc["accessors"].append({"bufferView":vi,"componentType":5121,"count":len(uvs),"type":"VEC4","normalized":True})
            prim["attributes"]["COLOR_0"]=ai
            coloured+=1
    for mat in doc["materials"]:
        mat.pop("normalTexture",None)
        mat["pbrMetallicRoughness"].pop("metallicRoughnessTexture",None)
    hair=doc["materials"][0]["pbrMetallicRoughness"]
    hair.pop("baseColorTexture",None)
    hair["baseColorFactor"]=[.22,.16,.12,1] if gender=="male" else [.16,.105,.075,1]
    body.pop("baseColorTexture",None)
    body["baseColorFactor"]=[1,1,1,1]
    body["metallicFactor"]=0
    body["roughnessFactor"]=.85
    # Keep a single embedded eye image; remove all other textures and images.
    eye_image_index=doc["textures"][doc["materials"][1]["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["source"]
    eye=download(doc["images"][eye_image_index]["uri"])
    off=append(eye)
    doc["bufferViews"].append({"buffer":0,"byteOffset":off,"byteLength":len(eye)})
    doc["images"]=[{"bufferView":len(doc["bufferViews"])-1,"mimeType":"image/png"}]
    doc["textures"]=[{"source":0}]
    doc["materials"][1]["pbrMetallicRoughness"]["baseColorTexture"]={"index":0}
    binary.extend(b"\0"*(-len(binary)%4))
    doc["buffers"]=[{"byteLength":len(binary)}]
    js=json.dumps(doc,separators=(",",":")).encode()
    js+=b" "*(-len(js)%4)
    result=(struct.pack("<4sII",b"glTF",2,12+8+len(js)+8+len(binary))
            +struct.pack("<I4s",len(js),b"JSON")+js
            +struct.pack("<I4s",len(binary),b"BIN\0")+binary)
    out=OUT/f"quaternius-{gender}-flat.glb"
    out.write_bytes(result)
    assert coloured>0 and len(doc.get("skins",[]))==1 and len(doc["skins"][0]["joints"])==65
    print(gender,"uncompressed:",len(result),"bytes; coloured meshes",coloured,flush=True)
for g in ("male","female"):make(g)
