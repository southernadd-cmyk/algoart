#!/usr/bin/env python3
"""Produce 20 test-only architectural KTX2 samples, preserving source size."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'automation/gallery-ktx2-20-manifest.json'
DATA=json.loads(MANIFEST.read_text())
assert len(DATA['textures'])==20
src_root=ROOT/DATA['root']
out_root=ROOT/DATA['output']
out_root.mkdir(parents=True,exist_ok=True)
rows=[]
for item in DATA['textures']:
    source=src_root/item['source']
    assert source.is_file(),source
    with Image.open(source) as im:
        size=im.size
        mode='RGB'
        if im.mode in ('RGBA','LA') or 'transparency' in im.info:
            mode='RGBA'
        with tempfile.TemporaryDirectory() as temp:
            tmp=Path(temp)/'source.png'
            im.convert(mode).save(tmp,format='PNG')
            dest=out_root/(item['id']+'.ktx2')
            kind=item['kind']
            # Normals keep high-fidelity 4x4 UASTC blocks (plus lossless Zstd).
            # Color and roughness use high-quality ETC1S for browser transfers.
            # Do not encode normals as sRGB or use two-channel normal mode.
            codec=(['--encode','uastc','--uastc_quality','3','--zcmp','6']
                   if kind=='normal' else
                   ['--encode','etc1s','--clevel','2','--qlevel','225'])
            oetf='srgb' if kind=='color' else 'linear'
            cmd=['toktx','--t2','--genmipmap',*codec,'--assign_oetf',oetf,
                 '--assign_primaries','none',str(dest),str(tmp)]
            subprocess.run(cmd,check=True)
    raw=dest.read_bytes()
    assert raw[:12]==bytes.fromhex('ab4b5458203230bb0d0a1a0a'),dest
    # KTX 2.0 header stores dimensions at offsets 20 and 24.
    import struct
    out_size=struct.unpack_from('<II',raw,20)
    assert out_size==size,(dest,out_size,size)
    assert len(raw)>128,dest
    rows.append({**item,'width':size[0],'height':size[1],
                 'sourceBytes':source.stat().st_size,'ktx2Bytes':len(raw),
                 'codec':'UASTC+Zstd' if kind=='normal' else 'ETC1S'})
    print(f"{item['id']:26} {kind:9} {size[0]}x{size[1]} source={source.stat().st_size:8} KTX2={len(raw):8} {rows[-1]['codec']}",flush=True)
totals={}
for usage in ['active','reception','optional']:
    these=[x for x in rows if x['usage']==usage]
    totals[usage]={'count':len(these),'originalBytes':sum(x['sourceBytes'] for x in these),
                   'ktx2Bytes':sum(x['ktx2Bytes'] for x in these)}
report={'format':'PROPORTION PIECE architecture KTX2-20 pilot',
        'scope':'test only','count':len(rows),'totals':totals,'textures':rows}
(out_root/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('TOTAL',json.dumps(totals),flush=True)
