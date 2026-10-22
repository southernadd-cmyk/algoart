// Two permanent, pre-defined landscape sculptural studies at the entrance.
// Based on the gallery's Golden Trajectories and Recursive Divisions vocabulary.
// Geometry is a fixed composition: no seeded regeneration, image processing or
// per-day artwork loading. Width 4.57 m (15 ft), height 3.66 m (12 ft).
import * as THREE from 'three';

const PHI=(1+Math.sqrt(5))/2;
const W=4.57,H=3.66;
const ink=(color)=>new THREE.MeshStandardMaterial({
 color,roughness:.76,metalness:.12,side:THREE.DoubleSide
});
const warm=ink(0x817269),light=ink(0xb5a083),dark=ink(0x394742),
      copper=ink(0xa8744f),sage=ink(0x737b65),black=ink(0x373a38);
const UNIT=(x,y)=>new THREE.Vector3(x*W,y*H,0);
function ribbon(group,points,thickness,material,depth=0){
 const curve=new THREE.CatmullRomCurve3(points.map(([x,y,z=0])=>new THREE.Vector3(x*W,y*H,depth+z)),false,'centripetal',.45);
 const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(20,points.length*7),thickness,5,false),material);
 group.add(tube);
}
function panel(group,x,y,w,h,depth,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w*W,h*H,depth),material);
 mesh.position.set(x*W,y*H,0);group.add(mesh);
}
function createComposition(kind){
 const root=new THREE.Group();
 if(kind==='trajectories'){
  // Fixed golden trajectories: large arcs, intersecting chords, visible
  // spatial layering and off-centre focal convergence.
  const centres=[[-.25,.08,.29,0,2.9],[-.12,-.09,.40,.4,3.5],[.16,.07,.46,1,4.8]];
  centres.forEach(([cx,cy,r,a,b],i)=>{
   const points=[];
   for(let j=0;j<=72;j++){
    const t=a+(b-a)*j/72;
    points.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r*.87,0]);
   }
   ribbon(root,points,i===0?.035:.023,[copper,dark,light][i],.08+i*.07);
  });
  for(const [points,weight,mat,z] of [
   [[[-.45,-.34],[.11,.17],[.45,.39]],.030,black,.21],
   [[[-.48,.24],[-.09,.04],[.45,-.31]],.022,light,.35],
   [[[-.18,-.46],[.17,.19],[.30,.46]],.018,sage,.40]
  ])ribbon(root,points,weight,mat,z);
  const focus=new THREE.Mesh(new THREE.SphereGeometry(.115,16,12),copper);
  focus.position.copy(UNIT(.11,.17));focus.position.z=.43;root.add(focus);
 }else{
  // A fixed, asymmetrical golden-rectangle relief composition, its physical
  // blocks deliberately stepping through depth rather than using a picture.
  const cells=[
   [-.279,0,.442,.83,.18,light], [.221,.231,.52,.369,.24,sage],
   [.221,-.196,.52,.48,.12,dark],[-.297,.324,.37,.19,.31,copper],
   [-.291,-.319,.39,.18,.36,warm],[.052,-.356,.17,.12,.42,light],
   [.365,.373,.20,.12,.4,copper],[.373,-.13,.19,.18,.34,warm]
  ];
  for(const [x,y,w,h,d,m] of cells){
   const box=new THREE.Mesh(new THREE.BoxGeometry(w*W,h*H,d),m);
   box.position.set(x*W,y*H,d*.25);root.add(box);
  }
  const divisions=[[-.5,0,.5,0],[-.06,-.48,-.06,.49],[-.48,.41,-.06,.41],[-.48,-.4,-.06,-.4],[.16,0,.16,.46]];
  for(const [a,b,c,d] of divisions)ribbon(root,[[a,b],[c,d]],.017,black,.5);
  for(let i=0;i<5;i++){
   const ratio=1/Math.pow(PHI,i+1);
   ribbon(root,[[.21+ratio*.13,-.2-ratio*.22],[.31+ratio*.17,-.14],[.46,.02+ratio*.12]],.012,copper,.54+i*.012);
  }
 }
 return root;
}
function monument(kind,plaza,side){
 const root=new THREE.Group();
 const across=plaza.transverse,out=plaza.outward;
 // Symmetrical across plaza, behind the starting approach's clear central axis.
 const offset=side*13.4,depth=1;
 const x=plaza.centre.x+across.x*offset+out.x*depth;
 const z=plaza.centre.z+across.z*offset+out.z*depth;
 root.position.set(x,plaza.level,z);
 // Artwork faces the middle approach; sculpture face normal looks out to plaza.
 // Angle both works inward towards the visitor's central approach, rather
 // than leaving them nearly parallel to the entrance. Their fronts converge
 // towards a point on the path, while keeping the walkway unobstructed.
 const facing=new THREE.Vector3(out.x*12-across.x*offset,0,out.z*12-across.z*offset).normalize();
 root.rotation.y=Math.atan2(facing.x,facing.z);
 const frame=new THREE.Group();root.add(frame);
 const structure=ink(0x53534d);
 // A substantial free-standing open steel frame; no canvas/paper backing.
 const profile=.095,baseHeight=.48;
 function beam(w,h,d,x,y,z){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),structure);
  m.position.set(x,y,z);frame.add(m);
 }
 beam(W+.22,profile,.23,0,baseHeight+H+.075,0);
 beam(W+.22,profile,.23,0,baseHeight-.07,0);
 for(const sx of [-1,1])beam(profile,H+.22,.23,sx*(W+.22)/2,baseHeight+H/2,0);
 // Spread feet, with all supporting geometry inside a 5.4 by 1.8m footprint.
 for(const sx of [-1,1]){
  beam(.12,baseHeight,.18,sx*W*.4,baseHeight/2,-.12);
  beam(.56,.10,1.4,sx*W*.4,.08,-.15);
 }
 const composition=createComposition(kind);
 composition.position.y=baseHeight+H/2;
 frame.add(composition);
 root.userData.permanentPlazaSculpture=kind;
 return root;
}
export function addPermanentPlazaSculptures(scene,plaza){
 if(!plaza)return [];
 const sculptures=[monument('trajectories',plaza,-1),monument('divisions',plaza,1)];
 for(const m of sculptures)scene.add(m);
 return sculptures;
}
