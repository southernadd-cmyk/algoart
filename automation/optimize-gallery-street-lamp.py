#!/usr/bin/env python3
"""Repack the original CC0 cast-iron street lamp with smaller embedded JPEGs.
Preserves mesh buffers, meshes, UVs, skin/scene, and material references.
Only replaces oversized 2K textures and eliminates unused binary padding.
"""
from pathlib import Path
from io import BytesIO
import json
import struct
from PIL import Image

base=Path(__file__).resolve().parents[1]/'test/virtual-gallery/models'
source=base/'polyhaven-street-lamp-01.glb'
destination=base/'polyhaven-street-lamp-01-optimized.glb'
src=source.read_bytes()
if src[:4]!=b'glTF' or struct.unpack_from('<I',src,4)[0]!=2:
    raise ValueError('Invalid source GLB')
json_length,json_type=struct.unpack_from('<I4s',src,12)
if json_type!=b'JSON':
    raise ValueError('Missing GLB JSON chunk')
gltf=json.loads(src[20:20+json_length])
binary_offset=20+json_length
binary_length,binary_type=struct.unpack_from('<I4s',src,binary_offset)
if binary_type!=b'BIN\x00':
    raise ValueError('Missing source GLB binary chunk')
binary=src[binary_offset+8:binary_offset+8+binary_length]
if len(binary)!=binary_length:
    raise ValueError('Truncated source buffer')
working=bytearray(binary)
image_count=0
for image in gltf.get('images',[]):
    view=gltf['bufferViews'][image['bufferView']]
    raw=binary[view['byteOffset']:view['byteOffset']+view['byteLength']]
    with Image.open(BytesIO(raw)) as texture:
        texture=texture.convert('RGB')
        texture.thumbnail((768,768),Image.Resampling.LANCZOS)
        buffer=BytesIO()
        texture.save(buffer,format='JPEG',quality=78,optimize=True)
        compressed=buffer.getvalue()
    view['byteOffset']=len(working)
    view['byteLength']=len(compressed)
    working.extend(compressed)
    working.extend(b'\x00'*(-len(working)%4))
    image_count+=1
# Only repack referenced bufferViews; original 2K images are not retained.
packed=bytearray()
for view in gltf['bufferViews']:
    contents=working[view['byteOffset']:view['byteOffset']+view['byteLength']]
    if len(contents)!=view['byteLength']:
        raise ValueError('Invalid buffer view')
    packed.extend(b'\x00'*(-len(packed)%4))
    view['byteOffset']=len(packed)
    packed.extend(contents)
packed.extend(b'\x00'*(-len(packed)%4))
gltf['buffers'][0]['byteLength']=len(packed)
encoded=json.dumps(gltf,separators=(',',':')).encode()
encoded+=b' '*(-len(encoded)%4)
length=12+8+len(encoded)+8+len(packed)
result=(struct.pack('<4sII',b'glTF',2,length)
       +struct.pack('<I4s',len(encoded),b'JSON')+encoded
       +struct.pack('<I4s',len(packed),b'BIN\x00')+packed)
if image_count<3 or length>1_600_000 or length>=len(src)*.4:
    raise ValueError('Lamp optimization did not produce a valid compact asset')
destination.write_bytes(result)
check=destination.read_bytes()
if struct.unpack_from('<I',check,8)[0]!=len(check):
    raise ValueError('Optimized binary length invalid')
print('Street lamp:',len(src),'->',len(check),'bytes; textures:',image_count)
