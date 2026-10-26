"""Prepare user-supplied CC-BY reception props; preserve originals and metadata."""
import sys,json,struct,zipfile,io,copy
from pathlib import Path
import numpy as np
from PIL import Image
source=Path(sys.argv[1]);out=Path('test/virtual-gallery/models');out.mkdir(exist_ok=True)
def load(path):
 if path.suffix=='.zip':
  z=zipfile.ZipFile(path);g=json.loads(z.read('scene.gltf'));return g,z.read('scene.bin'),lambda im:z.read(im['uri'])
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);data=b[28+n:]
 def image(im):
  v=g['bufferViews'][im['bufferView']];return data[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 return g,data,image

def save(path,g,data,images):
 # Keep vertex/index data byte-for-byte; replace only embedded texture views.
 g=copy.deepcopy(g);binary=bytearray(data)
 def view(raw):
  binary.extend(b'\0'*((-len(binary))%4));offset=len(binary);binary.extend(raw);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});return len(g['bufferViews'])-1
 for i,im in enumerate(g.get('images',[])):
  image=Image.open(io.BytesIO(images[i]));image.thumbnail((768,768));buf=io.BytesIO()
  if image.mode=='RGBA' and image.getextrema()[3][0]<255:
   image.quantize(colors=256,method=Image.Quantize.FASTOCTREE).save(buf,format='PNG',optimize=True);mime='image/png'
  else:image.convert('RGB').save(buf,format='JPEG',quality=84,optimize=True);mime='image/jpeg'
  g['images'][i]={'bufferView':view(buf.getvalue()),'mimeType':mime}
 # Repack only views referenced by attributes, indices or images. Old embedded
 # image bytes must not remain in the output after texture optimisation.
 used=set()
 for a in g.get('accessors',[]):
  if 'bufferView' in a:used.add(a['bufferView'])
 for im in g.get('images',[]):used.add(im['bufferView'])
 packed=bytearray();mapping={}
 for old in sorted(used):
  v=g['bufferViews'][old];packed.extend(b'\0'*((-len(packed))%4));off=len(packed);packed.extend(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);nv={**v,'buffer':0,'byteOffset':off};mapping[old]=len(mapping);g['bufferViews'][old]=nv
 g['bufferViews']=[g['bufferViews'][old] for old in sorted(used)]
 for a in g.get('accessors',[]):
  if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
 for im in g.get('images',[]):im['bufferView']=mapping[im['bufferView']]
 g['buffers']=[{'byteLength':len(packed)}];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);packed+=b'\0'*((-len(packed))%4)
 raw=struct.pack('<III',0x46546c67,2,28+len(js)+len(packed))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(packed),0x004e4942)+packed
 path.write_bytes(raw);print(path,len(raw))

for filename,dest in [('free_pothos_potted_plant_-_money_plant.zip','pothos-plant.glb'),('set_of_cardboard_boxes.glb','cardboard-boxes.glb'),('door.glb','gothic-entrance-door.glb')]:
 g,data,getimage=load(source/filename);images=[getimage(im) for im in g.get('images',[])]
 if filename=='door.glb':
  # The full-width connected component is the fixed arched surround. Every
  # other component belongs to one leaf, including its attached ironwork.
  pr=g['meshes'][0]['primitives'][0]
  def acc(i):
   a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];k={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];return np.frombuffer(data,dtype=dt,count=a['count']*k,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,k).copy()
  pos=acc(pr['attributes']['POSITION']);faces=acc(pr['indices']).reshape(-1,3);normal=acc(pr['attributes']['NORMAL']);uv=acc(pr['attributes']['TEXCOORD_0']);lo=pos.min(0);hi=pos.max(0);mid=(lo+hi)/2;scale=4.5/(hi[1]-lo[1]);width=(hi[2]-lo[2])*scale
  _,ids=np.unique(np.round(pos,4),axis=0,return_inverse=True);parents=list(range(ids.max()+1))
  def root(a):
   while parents[a]!=a:parents[a]=parents[parents[a]];a=parents[a]
   return a
  for a,b,c in ids[faces]:r=root(a);parents[root(b)]=r;parents[root(c)]=r
  labels=np.array([root(i) for i in ids]);fixed=set()
  for label in set(labels):
   v=pos[labels==label];
   if v[:,2].min()<mid[2]-.1 and v[:,2].max()>mid[2]+.1:fixed.add(label)
  groups=[[],[],[]]
  for face in faces:groups[0 if labels[face[0]] in fixed else 1 if pos[face,2].mean()<mid[2] else 2].append(face)
  pos=np.stack([(pos[:,2]-mid[2])*scale,(pos[:,1]-lo[1])*scale,(pos[:,0]-mid[0])*scale],axis=1).astype('<f4');normal=normal[:,[2,1,0]].astype('<f4')
  binary=bytearray();views=[];accessors=[]
  def add(a,kind,component):
   binary.extend(b'\0'*((-len(binary))%4));off=len(binary);raw=a.tobytes();binary.extend(raw);views.append({'buffer':0,'byteOffset':off,'byteLength':len(raw)});entry={'bufferView':len(views)-1,'componentType':component,'count':len(a),'type':kind}
   if kind=='VEC3':entry.update(min=a.min(0).tolist(),max=a.max(0).tolist())
   accessors.append(entry);return len(accessors)-1
  attrs={'POSITION':add(pos,'VEC3',5126),'NORMAL':add(normal,'VEC3',5126),'TEXCOORD_0':add(uv.astype('<f4'),'VEC2',5126)}
  meshes=[]
  for name,group in zip(['Entrance_Frame','Entrance_Left','Entrance_Right'],groups):
   index=add(np.array(group,dtype='<u4')[:,[0,2,1]].ravel(),'SCALAR',5125);meshes.append({'name':name,'primitives':[{'attributes':attrs,'indices':index,'material':0}]})
  g={**g,'bufferViews':views,'accessors':accessors,'meshes':meshes,'nodes':[{'name':m['name'],'mesh':i} for i,m in enumerate(meshes)],'scenes':[{'nodes':[0,1,2]}],'scene':0};data=bytes(binary);g['asset']['extras']['modifications']='Textures compressed; frame and two hinged leaves separated; scale normalised to 4.5m high.';g['asset']['extras']['doorWidth']=float(width)
 save(out/dest,g,data,images)
