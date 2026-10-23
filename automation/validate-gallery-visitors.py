#!/usr/bin/env python3
"""Inspect visitor GLB composition and validate a separate Meshopt candidate.
Does not change the gallery or claim visual validation of skinning.
"""
import json
import struct
import sys
from pathlib import Path

FOLDER=Path(__file__).resolve().parents[1]/'test/virtual-gallery/models'
ORIGINAL=FOLDER/'human-male-female-rigged.glb'
CANDIDATE=Path(__file__).resolve().parents[1]/'gallery/visit/models/human-male-female-rigged-optimized.glb'

def read(path):
    data=path.read_bytes()
    if data[:4]!=b'glTF' or len(data)<20:
        raise ValueError(f'Invalid GLB: {path}')
    version,length=struct.unpack_from('<II',data,4)
    if version!=2 or length!=len(data):
        raise ValueError('Invalid GLB version or length')
    size,kind=struct.unpack_from('<I4s',data,12)
    if kind!=b'JSON':
        raise ValueError('Missing GLB JSON')
    return data,json.loads(data[20:20+size])

def counts(g):
    return {x:len(g.get(x,[])) for x in ('scenes','nodes','meshes','skins','animations','images','textures','materials','accessors')}

def joint_names(g):
    nodes=g.get('nodes',[])
    return sorted(sorted(nodes[i].get('name','') for i in skin['joints']) for skin in g.get('skins',[]))

def rig_names(g):
    nodes=g.get('nodes',[])
    return sorted(n.get('name','') for n in nodes if 'skin' in n)

def summary(data,g):
    views=g.get('bufferViews',[])
    imgs=g.get('images',[])
    iv={im['bufferView'] for im in imgs if 'bufferView' in im}
    image_bytes=sum(views[i]['byteLength'] for i in iv)
    return {'bytes':len(data),'counts':counts(g),'embeddedImageBytes':image_bytes,
       'otherBufferViewBytes':sum(v['byteLength'] for i,v in enumerate(views) if i not in iv),
       'extensionsRequired':g.get('extensionsRequired',[]),'skinJointCounts':[len(x['joints']) for x in g.get('skins',[])]}

source,a=read(ORIGINAL)
print('Original:',json.dumps(summary(source,a),sort_keys=True))
if sys.argv[1:] == ['inspect']:
    sys.exit(0)
if sys.argv[1:] != ['verify']:
    raise SystemExit('Usage: validate-gallery-visitors.py inspect|verify')
result,b=read(CANDIDATE)
print('Candidate:',json.dumps(summary(result,b),sort_keys=True))
if len(result)>=len(source):
    raise ValueError('Candidate is not smaller')
if 'EXT_meshopt_compression' not in b.get('extensionsRequired',[]):
    raise ValueError('Meshopt encoding missing')
if not a.get('skins') or not b.get('skins'):
    raise ValueError('Visitor skeleton missing')
if len(a.get('skins',[]))!=len(b.get('skins',[])):
    raise ValueError('Changed skin count')
if joint_names(a)!=joint_names(b):
    raise ValueError('Skin joint names changed')
if rig_names(a)!=rig_names(b):
    raise ValueError('Skinned mesh nodes changed')
if len(a.get('meshes',[]))!=len(b.get('meshes',[])):
    raise ValueError('Mesh count changed')
if len(a.get('animations',[]))!=len(b.get('animations',[])):
    raise ValueError('Animation count changed')
for i,(mesh_a,mesh_b) in enumerate(zip(a['meshes'],b['meshes'])):
    if len(mesh_a.get('primitives',[])) != len(mesh_b.get('primitives',[])):
        raise ValueError(f'Changed primitive count in mesh {i}')
    for pa,pb in zip(mesh_a.get('primitives',[]),mesh_b.get('primitives',[])):
        for attribute in ('JOINTS_0','WEIGHTS_0'):
            if (attribute in pa.get('attributes',{})) != (attribute in pb.get('attributes',{})):
                raise ValueError(f'Lost skin attribute {attribute} in mesh {i}')
print(f'PASS: {(1-len(result)/len(source))*100:.1f}% smaller, skeleton and mesh structure preserved')
print('Visual pose and waist validation is still required before production deployment.')
