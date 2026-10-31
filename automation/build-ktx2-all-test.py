#!/usr/bin/env python3
"""Build KTX2 counterparts for EVERY JPEG source eligible for the 3D TEST tower.
404 archived paintings + 11 local architectural/environment JPEGs, plus
five unique Poly Haven runtime JPEGs. Live/gallery archive originals unchanged.
Executed in GitHub Actions; binary assets committed only under test.
"""
from __future__ import annotations
import concurrent.futures, hashlib, json, os, re, subprocess, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test/virtual-gallery/ktx2-all'
REMOTE=[
 ('plastered_wall_02_diff_1k','plastered_wall_02/plastered_wall_02_diff_1k.jpg','color'),
 ('plastered_wall_02_nor_gl_1k','plastered_wall_02/plastered_wall_02_nor_gl_1k.jpg','normal'),
 ('concrete_floor_diff_1k','concrete_floor/concrete_floor_diff_1k.jpg','color'),
 ('concrete_floor_nor_gl_1k','concrete_floor/concrete_floor_nor_gl_1k.jpg','normal'),
 ('wood_floor_diff_1k','wood_floor/wood_floor_diff_1k.jpg','color')
]
LOCAL=subprocess.check_output(['git','ls-files','--','gallery','test/virtual-gallery'],cwd=ROOT,text=True).splitlines()
# The original archive-preview JPEGs are HTML thumbnails, not gallery GPU maps.
# The existing live duplicates must never be modified or copied into test.
SOURCE=[Path(x) for x in LOCAL if
 x.lower().endswith(('.jpg','.jpeg')) and (
  re.fullmatch(r'gallery/\d{4}-\d{2}-\d{2}/(?!archive-preview\.jpg)[^/]+',x) or
  x.startswith('test/virtual-gallery/'))]
assert len([p for p in SOURCE if p.parts[0]=='gallery'])>=300, 'Artwork JPEG scan unexpectedly incomplete'
assert len(set(SOURCE))==len(SOURCE)
def kind(path):
 name=path.stem.lower()
 if 'normal' in name or 'nor_gl' in name:return 'normal'
 if 'roughness' in name:return 'roughness'
 return 'color'
def crop_size(size,maximum=1100):
 # Artwork is displayed no larger than 1100 px on desktop and 640 on
 # mobile. Keep exact source resolution for architecture/environment.
 w,h=size;scale=min(1,maximum/max(w,h))
 return max(1,round(w*scale)),max(1,round(h*scale))
def encode(entry):
 path,source,ktx_path,tex_kind,is_artwork=entry
 if not ktx_path.exists():
  ktx_path.parent.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory() as tmp:
   png=Path(tmp)/'input.png'
   with Image.open(source) as im:
    im=im.convert('RGB')
    if is_artwork:
     size=crop_size(im.size)
     if size!=im.size:im=im.resize(size,Image.Resampling.LANCZOS)
    else:size=im.size
    im.save(png,format='PNG')
   if tex_kind=='normal':
    codec=['--encode','uastc','--uastc_quality','2','--zcmp','6']
   else:
    # High quality ETC1S: preserves art colours while keeping the 400+
    # archived paintings well below GitHub Pages artifact limits.
    codec=['--encode','etc1s','--clevel','2','--qlevel','245']
   cmd=['toktx','--t2','--genmipmap',*codec,
    '--assign_oetf','srgb' if tex_kind=='color' else 'linear',
    '--assign_primaries','none',str(ktx_path),str(png)]
   subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 else:
  with Image.open(source) as im:size=crop_size(im.size) if is_artwork else im.size
 raw=ktx_path.read_bytes()
 assert raw[:12]==bytes.fromhex('ab4b5458203230bb0d0a1a0a'),ktx_path
 return {'source':str(path),'ktx2':str(ktx_path.relative_to(OUT)),
  'kind':tex_kind,'artwork':is_artwork,'width':size[0],'height':size[1],
  'originalBytes':source.stat().st_size,'ktx2Bytes':len(raw),
  'codec':'UASTC+Zstd' if tex_kind=='normal' else 'ETC1S'}
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 entries=[]
 for path in SOURCE:
  is_artwork=path.parts[0]=='gallery'
  dest=OUT/(str(path)+'.ktx2')
  entries.append((path,ROOT/path,dest,kind(path),is_artwork))
 remote_sources=[]
 with tempfile.TemporaryDirectory() as temp:
  for name,subpath,tex_kind in REMOTE:
   url='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/'+subpath
   dest=Path(temp)/(name+'.jpg')
   with urlopen(url,timeout=60) as stream:dest.write_bytes(stream.read())
   remote_sources.append((url,dest,OUT/('external/'+name+'.ktx2'),tex_kind,False))
  entries.extend(remote_sources)
  print('Building',len(entries),'JPEG texture KTX2 counterparts;',
   sum(1 for x in entries if x[4]),'archived paintings',flush=True)
  rows=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
   futures={ex.submit(encode,entry):entry for entry in entries}
   for idx,future in enumerate(concurrent.futures.as_completed(futures),1):
    result=future.result()
    rows.append(result)
    if idx%25==0 or idx==len(entries):
     print('DONE',idx,'/',len(entries),'last=',result['source'],flush=True)
  rows.sort(key=lambda r:r['source'])
  report={'description':'Every archived artwork JPEG and every local or remote JPEG architectural texture in the 3D TEST tower',
   'count':len(rows),'artworkCount':sum(x['artwork'] for x in rows),
   'originalBytes':sum(x['originalBytes'] for x in rows),
   'ktx2Bytes':sum(x['ktx2Bytes'] for x in rows),'entries':rows}
  (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
  print('KTX_ALL_DONE',json.dumps({k:report[k] for k in ('count','artworkCount','originalBytes','ktx2Bytes')}),flush=True)
if __name__=='__main__':main()
