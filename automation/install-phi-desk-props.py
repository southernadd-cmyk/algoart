"""Prepare the uploaded CC-BY cabinet and paper props without unused UV sets.
Usage: python3 automation/install-phi-desk-props.py /path/to/uploads
"""
import sys,json,struct,copy,io
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(sys.argv[1]);target=Path('test/virtual-gallery/models')
for filename,name in [('art_magazines_on_old_cabinet_scaniverse_lidar.glb','magazine-cabinet.glb'),('paper_debris.glb','paper-clutter.glb')]:
 b=(root/filename).read_bytes();n=struct.unpack_from('<I',b,12)[0];original=json.loads(b[20:20+n]);data=b[28+n:];g=copy.deepcopy(original);packed=bytearray();views=[];accessors=[];mapping={}
 def add(raw):
  packed.extend(b'\0'*((-len(packed))%4));offset=len(packed);packed.extend(raw);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});return len(views)-1
 def accessor(i):
  if i in mapping:return mapping[i]
  a=copy.deepcopy(original['accessors'][i]);v=original['bufferViews'][a['bufferView']];k={'VEC2':2,'VEC3':3,'VEC4':4,'SCALAR':1}[a['type']];dtype=np.dtype({5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']]);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  array=np.ndarray((a['count'],k),dtype=dtype,buffer=data,offset=offset,strides=(v.get('byteStride',k*dtype.itemsize),dtype.itemsize)).copy();a['bufferView']=add(array.tobytes());a.pop('byteOffset',None);mapping[i]=len(accessors);accessors.append(a);return mapping[i]
 for m in g['meshes']:
  for p in m['primitives']:
   p['attributes']={s:accessor(i) for s,i in p['attributes'].items() if s in ['POSITION','NORMAL','TANGENT','TEXCOORD_0']};p['indices']=accessor(p['indices'])
 for im in g['images']:
  v=original['bufferViews'][im['bufferView']];image=Image.open(io.BytesIO(data[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]));limit=512 if name=='paper-clutter.glb' else 768;image.thumbnail((limit,limit),Image.Resampling.LANCZOS);out=io.BytesIO()
  image.convert('RGB').save(out,format='JPEG',quality=90 if im.get('mimeType')=='image/png' else 86,optimize=True)
  im['bufferView']=add(out.getvalue());im['mimeType']='image/jpeg'
 g.update(accessors=accessors,bufferViews=views,buffers=[{'byteLength':len(packed)}]);g['asset']['extras']['modifications']='Unused UV sets removed; textures resized and recompressed; selected objects rescaled and positioned in reception.'
 js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);packed+=b'\0'*((-len(packed))%4);raw=struct.pack('<III',0x46546c67,2,28+len(js)+len(packed))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(packed),0x004e4942)+packed
 (target/name).write_bytes(raw);print(name,len(b),'->',len(raw))
