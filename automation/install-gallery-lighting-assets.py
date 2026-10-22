#!/usr/bin/env python3
"""Install two CC0 gallery assets from their original publishers.

Downloaded in CI, checked, then committed as same-origin static assets:
https://www.innerscene.com/tools/library/3d-parts/twin-spot-twin-surface-spotlight-68df1e43
https://ambientcg.com/view?id=OfficeCeiling001
"""
from pathlib import Path
from io import BytesIO
import struct, zipfile
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "test" / "virtual-gallery"
MODEL = ROOT / "models" / "twin-surface-spotlight.glb"
TEXTURES = ROOT / "textures"
SPOTLIGHT_URL = "https://www.innerscene.com/api/library/twin-spot-twin-surface-spotlight-68df1e43/download"
CEILING_URL = "https://ambientcg.com/get?file=OfficeCeiling001_1K-JPG.zip"

def download(url, maximum):
    request = Request(url, headers={"User-Agent": "ProportionPieceGallery/1.0 (CC0 asset installation)"})
    with urlopen(request, timeout=90) as response:
        body = response.read(maximum + 1)
    if len(body) > maximum:
        raise ValueError("Asset exceeds expected size: " + url)
    return body

def spotlight():
    data = download(SPOTLIGHT_URL, 4_000_000)
    if len(data) < 200 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 8)[0] != len(data):
        raise ValueError("Innerscene did not return a valid GLB")
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    MODEL.write_bytes(data)
    print("Twin surface spotlight:", len(data), "bytes")

def ceiling():
    data = download(CEILING_URL, 35_000_000)
    with zipfile.ZipFile(BytesIO(data)) as archive:
        for kind in ("Color", "NormalGL", "Roughness"):
            source = "OfficeCeiling001_1K-JPG_" + kind + ".jpg"
            with Image.open(BytesIO(archive.read(source))) as image:
                image.load()
                if image.size != (1024, 1024):
                    raise ValueError(source + " has unexpected dimensions")
                # 768px is sufficient for roof tiles while keeping initial
                # download and GPU pressure lower than the full source scan.
                image = image.convert("RGB").resize((768, 768), Image.Resampling.LANCZOS)
                TEXTURES.mkdir(parents=True, exist_ok=True)
                destination = TEXTURES / ("OfficeCeiling001_" + kind + ".jpg")
                image.save(destination, "JPEG", quality=86, optimize=True, subsampling=0)
                print(kind, destination.stat().st_size, "bytes")
if __name__ == "__main__":
    spotlight()
    ceiling()
