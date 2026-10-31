#!/usr/bin/env python3
"""Build exact-pixel KTX2 Zstd/RGBA counterparts of EVERY gallery JPEG.
Artwork files under gallery/<day>/ and gallery/release-art/ and all TEST
architectural/environment JPEGs. NEVER modify the sources or live tower.
No GPU block compression, resizing, or generated mip levels.
"""
from __future__ import annotations
import concurrent.futures, hashlib, json, os, re, struct, subprocess, tempfile
from pathlib import Path
from urllib.request import urlopen
import zstandard
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test/virtual-gallery/ktx2-lossless'
MAGIC=bytes.fromhex('ab4b5458203230bb0d0a1a0a')
REMOTE=[
 ('plastered_wall_02_diff_1k','plastered_wall_02/plastered_wall_02_diff_1k.jpg','color'),
 ('plastered_wall_02_nor_gl_1k','plastered_wall_02/plastered_wall_02_nor_gl_1k.jpg','normal'),
 ('concrete_floor_diff_1k','concrete_floor/concrete_floor_diff_1k.jpg','color'),
 ('concrete_floor_nor_gl_1k','concrete_floor/concrete_floor_nor_gl_1k.jpg','normal'),
 ('wood_floor_diff_1k','wood_floor/wood_floor_diff_1k.jpg','color')
]
paths=subprocess.check_output(['git','ls-files','--','gallery','test/virtual-gallery'],cwd=ROOT,text=True).splitlines()
LOCAL=[Path(x) for x in paths if x.lower().endswith(('.jpg','.jpeg')) and (
 (x.startswith('gallery/') and not x.startswith('gallery/visit/')
  and not x.endswith('/archive-preview.jpg'))
 or x.startswith('test/virtual-gallery/'))]
assert len([p for p in LOCAL if p.parts[0]=='gallery'])>=404, 'Artwork inventory unexpectedly incomplete'
assert len([p for p in LOCAL if p.parts[:2]==('gallery','release-art')])>=6
assert len(set(LOCAL))==len(LOCAL)
def kind(path):
 base=path.stem.lower()
 if 'normal' in base or 'nor_gl' in base:return 'normal'
 if 'roughness' in base:return 'roughness'
 return 'color'
def digest(data):return hashlib.sha256(data).hexdigest()
def encode(entry):
 path,source,dest,tex_kind,is_art=entry
 # The original decoder establishes canonical RGB pixels. Never resize.
 with Image.open(source) as image:
  image=ImageOps.exif_transpose(image).convert('RGBA')
  expected=image.tobytes()
  w,h=image.size
 dest.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory() as tmp:
  png=Path(tmp)/'pixel-exact.png'
  image.save(png,format='PNG')
  # Raw RGBA VK_FORMAT_R8G8B8A8_(S)RGB and lossless ZSTD. No Basis encoders.
  args=['toktx','--t2','--zcmp','8','--assign_oetf',
   'srgb' if tex_kind=='color' else 'linear','--assign_primaries','bt709',
   str(dest),str(png)]
  subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 raw=dest.read_bytes()
 assert raw[:12]==MAGIC,(dest,'KTX2 magic')
 vk,typ,width,height,depth,layers,faces,levels,scheme=struct.unpack_from('<9I',raw,12)
 assert vk in (37,43),(dest,'Not raw RGBA8',vk)
 assert vk==(43 if tex_kind=='color' else 37),(dest,'Incorrect gamma format',vk)
 assert scheme==2,(dest,'Expected lossless ZSTD',scheme)
 assert (width,height)==(w,h),(dest,'Pixels resized')
 assert (depth,layers,faces,levels)==(0,0,1,1),(dest,'Unexpected dimensions or mipmaps',levels)
 offset,length,uncompressed=struct.unpack_from('<QQQ',raw,80)
 level=zstandard.ZstdDecompressor().decompress(raw[offset:offset+length],max_output_size=uncompressed)
 assert len(level)==len(expected)==w*h*4,(dest,'Byte size mismatch')
 assert level==expected,(dest,'PIXEL MISMATCH')
 return {
  'source':str(path),'target':str(dest.relative_to(OUT)),'artwork':is_art,
  'kind':tex_kind,'width':w,'height':h,
  'sourceBytes':source.stat().st_size,'ktx2Bytes':len(raw),
  'pixelSha256':digest(expected),'ktxPixelSha256':digest(level),
  'pixelIdentical':True
 }
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 entries=[(p,ROOT/p,OUT/(str(p)+'.ktx2'),kind(p),p.parts[0]=='gallery') for p in LOCAL]
 with tempfile.TemporaryDirectory() as temp:
  for name,subpath,kind_name in REMOTE:
   url='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/'+subpath
   source=Path(temp)/(name+'.jpg')
   with urlopen(url,timeout=60) as stream:source.write_bytes(stream.read())
   entries.append((url,source,OUT/('external/'+name+'.ktx2'),kind_name,False))
  print('PIXEL_EXACT_INPUT_COUNT',len(entries),'artworks',sum(i[4] for i in entries),flush=True)
  results=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
   futures=[pool.submit(encode,item) for item in entries]
   for i,future in enumerate(concurrent.futures.as_completed(futures),1):
    result=future.result() # Abort the entire pipeline on ANY pixel difference.
    results.append(result)
    if i%25==0 or i==len(entries):print('PIXEL_IDENTICAL',i,'/',len(entries),flush=True)
  results.sort(key=lambda x:x['source'])
  report={'version':1,'format':'VK_FORMAT_R8G8B8A8 with lossless ZSTD',
   'scope':'all local JPEG artwork and architecture plus five external Poly Haven maps',
   'pixelIdentity':'Decoded RGBA source bytes == decoded raw KTX2 level-zero RGBA bytes, checked on every asset',
   'artworkCount':sum(x['artwork'] for x in results),'count':len(results),
   'sourceBytes':sum(x['sourceBytes'] for x in results),
   'ktx2Bytes':sum(x['ktx2Bytes'] for x in results),
   'allPixelIdentical':all(x['pixelIdentical'] for x in results),
   'entries':results}
  (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
  print('PIXEL_EXACT_KTX2_PASS',json.dumps({k:report[k] for k in ['count','artworkCount','sourceBytes','ktx2Bytes','allPixelIdentical']}),flush=True)
if __name__=='__main__':main()
