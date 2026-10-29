import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadPhiDecorAsset} from './phi-model-assets.mjs';
// Ancient Church Window by MWOgier — CC BY 4.0. Trimmed scan, metre
// transforms baked and geometry/textures reduced; both faces share resources.
const windowModelURL=new URL('./models/reception-church-window.glb',import.meta.url).href;
const PROFILE=[[-1.1316400580551524,0.0],[1.1316400580551524,0.0],[1.1316400580551524,1.9277939042089989],[1.11247165275762,2.0405354227140786],[1.0862617924528302,2.150929789550073],[1.0530104771407838,2.2589770047169813],[1.0127177068214805,2.3646770682148044],[0.9653834814949203,2.468029980043542],[0.9110078011611031,2.569035740203193],[0.8495906658200291,2.667694348693759],[0.7811320754716983,2.7640058055152394],[0.7056320301161103,2.8579701106676345],[0.6230905297532656,2.9495872641509435],[0.5335075743831641,3.0388572659651674],[0.43688316400580557,3.125780116110305],[0.33321729862119015,3.2103558145863573],[0.22250997822931787,3.292584361393324],[0.1047612028301887,3.372465756531205],[-0.02002902757619739,3.45],[-0.14114205370101598,3.3718789686139337],[-0.25537010159651674,3.291489023947751],[-0.3627131712626996,3.2088301660014515],[-0.46317126269956466,3.123902394775037],[-0.5567443759071118,3.0367057102685053],[-0.6434325108853411,2.9472401124818584],[-0.7232356676342526,2.8555056014150946],[-0.7961538461538463,2.761502177068215],[-0.862187046444122,2.6652298394412193],[-0.9213352685050799,2.5666885885341073],[-0.9735985123367199,2.4658784243468794],[-1.0189767779390422,2.3627993468795356],[-1.0574700653120466,2.2574513561320755],[-1.089078374455733,2.1498344521044994],[-1.1138017053701017,2.039948634796807],[-1.1316400580551524,1.9277939042089989]];
export const RECEPTION_WINDOW_WIDTH=2.263280116110305;

export const RECEPTION_WINDOW_PITCH=RECEPTION_WINDOW_WIDTH+.64;
export const RECEPTION_WINDOW_BORDER=.24;
export function planPhiReceptionWindow(entrance){
 if(!entrance||entrance.axis!=='z')return null;
 const first={axis:'z',at:entrance.at,x:entrance.centre+7.9,sill:.85,
  width:RECEPTION_WINDOW_WIDTH,height:3.45};
 return {...first,windows:Array.from({length:3},(_,i)=>({...first,x:first.x+i*RECEPTION_WINDOW_PITCH}))};
}
// Cut every bay from both wall layers. Collision stays continuous at ground
// level because all three glazed openings start above the floor.
export function receptionWindowWallParts(w,opening,wallHeight=5.2){
 const full=[{lo:w.lo,hi:w.hi,bottom:0,height:wallHeight}];
 if(!opening||w.axis!=='z'||Math.abs(w.at-opening.at)>.001)return full;
 const holes=(opening.windows||[opening]).map(o=>({
  left:Math.max(w.lo,o.x-o.width/2),right:Math.min(w.hi,o.x+o.width/2),
  sill:o.sill,top:o.sill+o.height
 })).filter(o=>o.right>o.left).sort((a,b)=>a.left-b.left);
 if(!holes.length)return full;
 const parts=[];let cursor=w.lo;
 for(const hole of holes){
  if(hole.left>cursor)parts.push({lo:cursor,hi:hole.left,bottom:0,height:wallHeight});
  parts.push({lo:hole.left,hi:hole.right,bottom:0,height:hole.sill},
   {lo:hole.left,hi:hole.right,bottom:hole.top,height:wallHeight-hole.top});
  cursor=hole.right;
 }
 if(cursor<w.hi)parts.push({lo:cursor,hi:w.hi,bottom:0,height:wallHeight});
 return parts.filter(p=>p.hi-p.lo>.001&&p.height>.001);
}
function offsetProfile(distance){
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 return PROFILE.map((point,i)=>{
  const previous=PROFILE[(i+PROFILE.length-1)%PROFILE.length],next=PROFILE[(i+1)%PROFILE.length];
  const a=[point[0]-previous[0],point[1]-previous[1]],b=[next[0]-point[0],next[1]-point[1]];
  const la=Math.hypot(...a),lb=Math.hypot(...b);
  const p=[point[0]+a[1]/la*distance,point[1]-a[0]/la*distance];
  const q=[point[0]+b[1]/lb*distance,point[1]-b[0]/lb*distance];
  const det=cross(a,b);
  if(Math.abs(det)<1e-8)return p;
  const t=cross([q[0]-p[0],q[1]-p[1]],b)/det;
  return [p[0]+t*a[0],p[1]+t*a[1]];
 });
}
// Jointed pale ashlar follows the scanned arch, rather than a rectangular
// patch of a second texture. Tiny bevels catch daylight without extra lights.
export function createReceptionWindowMasonryGeometry(THREE){
 const outer=offsetProfile(RECEPTION_WINDOW_BORDER),parts=[];
 const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 for(let i=0;i<PROFILE.length;i++){
  const j=(i+1)%PROFILE.length,a=PROFILE[i],b=PROFILE[j];
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const count=Math.max(1,Math.ceil(length/.23));
  for(let k=0;k<count;k++){
   const gap=.004/Math.max(length,.01),t0=k/count+gap,t1=(k+1)/count-gap;
   const points=[lerp(a,b,t0),lerp(a,b,t1),lerp(outer[i],outer[j],t1),lerp(outer[i],outer[j],t0)];
   const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
   const geo=new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,
    bevelSize:.004,bevelThickness:.004,bevelSegments:1,steps:1});
   const tone=.94+.06*((i*7+k*3)%11)/10;
   const colors=new Float32Array(geo.attributes.position.count*3).fill(tone);
   geo.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(geo);
  }
 }
 const result=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
 result.computeBoundingBox();return result;
}
export function addPhiReceptionWindow(THREE,parent,{opening,elevation=0,brick}){
 if(!opening)return null;
 const bays=opening.windows||[opening];
 const root=new THREE.Group();root.name='phi-reception-church-window';parent.add(root);
 root.userData.attribution='Ancient Church Window — MWOgier — CC BY 4.0';
 root.userData.opening={...opening};root.userData.windowCount=bays.length;
 const paleStone=new THREE.MeshStandardMaterial({color:'#d5cbb5',roughness:.94,vertexColors:true});
 const plainStone=new THREE.MeshStandardMaterial({color:'#c8bca2',roughness:.94});
 const masonry=createReceptionWindowMasonryGeometry(THREE);
 const holders=bays.map((bay,index)=>{
  const holder=new THREE.Group();holder.name='phi-reception-window-bay-'+(index+1);
  holder.position.set(bay.x,elevation+bay.sill,bay.at);root.add(holder);
  // Retain matching black brick behind the pale arch border.
  const hw=bay.width/2,upper=new THREE.Shape(),spring=PROFILE[2][1];
  upper.moveTo(-hw,spring);upper.lineTo(-hw,bay.height);
  upper.lineTo(hw,bay.height);upper.lineTo(hw,spring);
  for(const [x,y] of PROFILE.slice(3))upper.lineTo(x,y);
  upper.closePath();
  const geo=new THREE.ExtrudeGeometry(upper,{depth:.265,bevelEnabled:false,steps:1});
  const uv=geo.attributes.uv,pos=geo.attributes.position,tile=brick.userData?.tileMeters||2.3;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+bay.x)/tile,(pos.getY(i)+bay.sill)/tile);
  const infill=new THREE.Mesh(geo,brick);infill.position.z=-.1325;
  infill.name='phi-window-matching-brick-arch-infill';infill.receiveShadow=true;holder.add(infill);
  for(const side of [-1,1]){
   const border=new THREE.Mesh(masonry,paleStone);border.position.z=side<0?-.334:.194;
   border.name='phi-window-pale-jointed-masonry-'+(side<0?'exterior':'interior');
   border.receiveShadow=true;holder.add(border);
  }
  return holder;
 });
 const left=bays[0].x-bays[0].width/2-RECEPTION_WINDOW_BORDER;
 const last=bays[bays.length-1],right=last.x+last.width/2+RECEPTION_WINDOW_BORDER;
 for(const [name,y,height,depth] of [
  ['shared-stone-sill',opening.sill-.18,.16,.68],
  ['shared-stone-head-course',opening.sill+opening.height+.34,.12,.60]
 ]){
  const course=new THREE.Mesh(new THREE.BoxGeometry(right-left+.12,height,depth),plainStone);
  course.name='phi-window-'+name;
  course.position.set((left+right)/2,elevation+y,opening.at);course.receiveShadow=true;root.add(course);
 }
 loadPhiDecorAsset(windowModelURL).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  for(const holder of holders)for(const side of [-1,1]){
   const face=source.clone(true);face.name=side<0?'church-window-exterior':'church-window-interior';
   face.rotation.y=side<0?Math.PI:0;face.scale.x=side<0?-1:1;face.position.z=side*.14;
   face.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});holder.add(face);
  }
  root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Reception church window unavailable',error));
 return root;
}
