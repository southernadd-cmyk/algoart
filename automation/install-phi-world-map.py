"""Convert the user's CC-BY map archive to a compact, front-facing GLB.
Usage: python3 automation/install-phi-world-map.py /path/to/vintage_framed_world_map.zip
Original texture pixels are retained; geometry is centred in metres facing +Z.
"""
import sys,json,struct,copy,zipfile
from pathlib import Path
import numpy as np
z=zipfile.ZipFile(sys.argv[1]);source=json.loads(z.read('scene.gltf'));data=z.read('scene.bin')
g=copy.deepcopy(source);packed=bytearray();views=[];accessors=[]
def add(raw):
 packed.extend(b'\0'*((-len(packed))%4));offset=len(packed);packed.extend(raw);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});return len(views)-1
def read(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];k={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']]
 return np.frombuffer(data,dtype=dtype,count=a['count']*k,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,k).copy()
positions=np.concatenate([read(p['attributes']['POSITION']) for m in g['meshes'] for p in m['primitives']]);converted=positions[:,[2,1,0]]*[-.01,.01,.01];lo=converted.min(0);hi=converted.max(0);offset=np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]])
for mesh in g['meshes']:
 for p in mesh['primitives']:
  for semantic,i in list(p['attributes'].items())+[('INDICES',p['indices'])]:
   a=copy.deepcopy(g['accessors'][i]);array=read(i)
   if semantic=='POSITION':array=((array[:,[2,1,0]]*[-.01,.01,.01])-offset).astype('<f4')
   elif semantic=='NORMAL':array=(array[:,[2,1,0]]*[-1,1,1]).astype('<f4')
   a['bufferView']=add(array.tobytes());a.pop('byteOffset',None)
   if semantic in ['POSITION','NORMAL']:a.update(min=array.min(0).tolist(),max=array.max(0).tolist())
   accessors.append(a);index=len(accessors)-1
   if semantic=='INDICES':p['indices']=index
   else:p['attributes'][semantic]=index
for image in g['images']:image['bufferView']=add(z.read(image.pop('uri')));image['mimeType']='image/jpeg'
for material in g['materials']:
 material.pop('extensions',None);material['pbrMetallicRoughness'].update(metallicFactor=0,roughnessFactor=.86)
g.pop('extensionsUsed',None);g.pop('extensionsRequired',None)
g.update(nodes=[{'name':m['name'],'mesh':i} for i,m in enumerate(g['meshes'])],scenes=[{'nodes':list(range(len(g['meshes'])))}],scene=0,bufferViews=views,accessors=accessors,buffers=[{'byteLength':len(packed)}])
g['asset']['extras']['modifications']='Geometry centred in metres, rotated to face +Z; materials adjusted for gallery lighting. Original texture pixels retained.'
js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);packed+=b'\0'*((-len(packed))%4)
raw=struct.pack('<III',0x46546c67,2,28+len(js)+len(packed))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(packed),0x004e4942)+packed
out=Path('test/virtual-gallery/models/vintage-world-map.glb');out.write_bytes(raw);print(out,len(raw),'bytes',hi-lo)
