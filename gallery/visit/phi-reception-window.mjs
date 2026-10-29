import {loadPhiDecorAsset} from './phi-model-assets.mjs';
// Ancient Church Window by MWOgier — CC BY 4.0. Trimmed scan, metre
// transforms baked and geometry/textures reduced; both faces share resources.
const windowModelURL=new URL('./models/reception-church-window.glb',import.meta.url).href;
const PROFILE=[[-1.1316400580551524,0.0],[1.1316400580551524,0.0],[1.1316400580551524,1.9277939042089989],[1.11247165275762,2.0405354227140786],[1.0862617924528302,2.150929789550073],[1.0530104771407838,2.2589770047169813],[1.0127177068214805,2.3646770682148044],[0.9653834814949203,2.468029980043542],[0.9110078011611031,2.569035740203193],[0.8495906658200291,2.667694348693759],[0.7811320754716983,2.7640058055152394],[0.7056320301161103,2.8579701106676345],[0.6230905297532656,2.9495872641509435],[0.5335075743831641,3.0388572659651674],[0.43688316400580557,3.125780116110305],[0.33321729862119015,3.2103558145863573],[0.22250997822931787,3.292584361393324],[0.1047612028301887,3.372465756531205],[-0.02002902757619739,3.45],[-0.14114205370101598,3.3718789686139337],[-0.25537010159651674,3.291489023947751],[-0.3627131712626996,3.2088301660014515],[-0.46317126269956466,3.123902394775037],[-0.5567443759071118,3.0367057102685053],[-0.6434325108853411,2.9472401124818584],[-0.7232356676342526,2.8555056014150946],[-0.7961538461538463,2.761502177068215],[-0.862187046444122,2.6652298394412193],[-0.9213352685050799,2.5666885885341073],[-0.9735985123367199,2.4658784243468794],[-1.0189767779390422,2.3627993468795356],[-1.0574700653120466,2.2574513561320755],[-1.089078374455733,2.1498344521044994],[-1.1138017053701017,2.039948634796807],[-1.1316400580551524,1.9277939042089989]];
export const RECEPTION_WINDOW_WIDTH=2.263280116110305;

export function planPhiReceptionWindow(entrance){
 if(!entrance||entrance.axis!=='z')return null;
 return {axis:'z',at:entrance.at,x:entrance.centre+7.9,sill:.85,
  width:RECEPTION_WINDOW_WIDTH,height:3.45};
}
// Keep the physical collision wall: the opening is above the floor.
// Both the plaster core and outer brick veneer use these same four pieces.
export function receptionWindowWallParts(w,opening,wallHeight=5.2){
 const full=[{lo:w.lo,hi:w.hi,bottom:0,height:wallHeight}];
 if(!opening||w.axis!=='z'||Math.abs(w.at-opening.at)>.001)return full;
 const left=Math.max(w.lo,opening.x-opening.width/2);
 const right=Math.min(w.hi,opening.x+opening.width/2);
 if(right<=left)return full;
 const top=opening.sill+opening.height;
 return [
  {lo:w.lo,hi:left,bottom:0,height:wallHeight},
  {lo:right,hi:w.hi,bottom:0,height:wallHeight},
  {lo:left,hi:right,bottom:0,height:opening.sill},
  {lo:left,hi:right,bottom:top,height:wallHeight-top}
 ].filter(p=>p.hi-p.lo>.001&&p.height>.001);
}
export function addPhiReceptionWindow(THREE,parent,{opening,elevation=0,brick}){
 if(!opening)return null;
 const root=new THREE.Group();root.name='phi-reception-church-window';
 root.position.set(opening.x,elevation+opening.sill,opening.at);parent.add(root);
 // Fill the rectangular cut above the pointed stone arch with the same
 // Bricks055 material as the facade, including a solid masonry reveal.
 const hw=opening.width/2,upper=new THREE.Shape();
 const spring=PROFILE[2][1];
 upper.moveTo(-hw,spring);upper.lineTo(-hw,opening.height);
 upper.lineTo(hw,opening.height);upper.lineTo(hw,spring);
 for(const [x,y] of PROFILE.slice(3))upper.lineTo(x,y);
 upper.closePath();
 const geo=new THREE.ExtrudeGeometry(upper,{depth:.265,bevelEnabled:false,steps:1});
 // Planar facade UVs retain the existing physical brick scale.
 const uv=geo.attributes.uv,pos=geo.attributes.position,tile=brick.userData?.tileMeters||2.3;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+opening.x)/tile,(pos.getY(i)+opening.sill)/tile);
 const surround=new THREE.Mesh(geo,brick);surround.position.z=-.1325;
 surround.name='phi-window-matching-brick-arch-infill';surround.receiveShadow=true;root.add(surround);
 // Visible stone sill meets the scan at the full wall depth.
 const sill=new THREE.Mesh(new THREE.BoxGeometry(opening.width+.12,.09,.42),
  new THREE.MeshStandardMaterial({color:'#a5997f',roughness:.96}));
 sill.position.y=-.025;sill.name='phi-window-continuous-stone-sill';root.add(sill);
 root.userData.attribution='Ancient Church Window — MWOgier — CC BY 4.0';
 root.userData.opening={...opening};
 loadPhiDecorAsset(windowModelURL).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  for(const side of [-1,1]){
   const face=source.clone(true);face.name=side<0?'church-window-exterior':'church-window-interior';
   face.rotation.y=side<0?Math.PI:0;face.scale.x=side<0?-1:1;face.position.z=side*.14;
   face.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});root.add(face);
  }
  root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Reception church window unavailable',error));
 return root;
}
