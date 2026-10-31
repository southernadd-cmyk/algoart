import {addPhiPubSign} from './phi-pub-sign.mjs';
import {addPhiOfficeFrontage} from './phi-office-reception.mjs?v=gallery-reception-20261027';
import {loadPhiDecorAsset as asset,fitPhiDecorAsset as fit} from './phi-model-assets.mjs';
import {createGothicSurroundShape} from './phi-gothic-door-profile.mjs';
import {renderVisitors} from './visitors.mjs?v=arms-forward-v10-20261022';
// Optional shared CC-BY props for the experimental reception. Loading never
// blocks the floor planner or lift. Credits are installed separately below.
const modelURL=name=>new URL('./models/'+name,import.meta.url).href;
export function addPhiReceptionDecor(THREE,scene,furnishing,elevation){
 const holders=[];
 if(globalThis.__phiReceptionTestRefresh)globalThis.__phiReceptionBackroomCount=furnishing.backrooms?.length||0;
 for(const [i,p] of furnishing.plants.entries()){
  const holder=new THREE.Group();holder.name='phi-pothos-'+i;holder.position.set(p.x,elevation,p.z);scene.add(holder);holders.push(holder);
  const pot=new THREE.Mesh(new THREE.BoxGeometry(.42,.55,.42),new THREE.MeshStandardMaterial({color:'#8a8070',roughness:.85}));pot.position.y=.275;holder.add(pot);
  const green=new THREE.Mesh(new THREE.IcosahedronGeometry(.4,1),new THREE.MeshStandardMaterial({color:'#54704b',roughness:.9}));green.position.y=.92;holder.add(green);
  asset(modelURL('pothos-plant.glb')).then(source=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   pot.visible=green.visible=false;
   const model=source.clone(true);
   model.traverse(o=>{if(o.isMesh&&o.material?.alphaMode!=='OPAQUE'&&o.material?.transparent){o.material.alphaTest=.35;o.material.transparent=false;o.material.depthWrite=true;}});
   holder.add(fit(THREE,model,1.45));holder.userData.modelLoaded=true;
  }).catch(error=>console.warn('Reception plant fallback',error));
 }
 if(furnishing.desk){
  const d=furnishing.desk,holder=new THREE.Group();holder.name='phi-reception-boxes';holder.position.set(d.x+1.7,elevation,d.z+1.35);scene.add(holder);holders.push(holder);
  asset(modelURL('cardboard-boxes.glb')).then(source=>{
   if(!holder.parent||holder.userData.galleryDisposed)return;
   source.updateMatrixWorld(true);let first;source.traverse(o=>{if(!first&&o.isMesh)first=o;});
   if(!first)return;
   for(const [x,y,z,angle] of [[0,0,0,.12],[.06,.31,-.04,-.08]]){
    const mesh=first.clone();first.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);const model=fit(THREE,mesh,.31);model.position.set(x,y,z);model.rotation.y=angle;holder.add(model);
   }
   holder.userData.modelLoaded=true;
  }).catch(error=>console.warn('Reception boxes unavailable',error));
 }
 // Small storage rooms: archive shelving and floor-stacked packing boxes.
 if(globalThis.__phiReceptionTestRefresh&&!globalThis.__phiLivingMonitorTest&&furnishing.backrooms?.length){
  const wood=new THREE.MeshStandardMaterial({color:'#9b846e',roughness:.86});
  const iron=new THREE.MeshStandardMaterial({color:'#434941',metalness:.38,roughness:.66});
  const card=new THREE.MeshStandardMaterial({color:'#c4b399',roughness:1});
  const cube=(g,w,h,d,x,y,z,m)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;
  };
  for(const [index,p] of furnishing.backrooms.entries()){
   const g=new THREE.Group();g.name='phi-reception-backroom-'+index;
   g.position.set(p.x,elevation,p.z);scene.add(g);holders.push(g);
   // Keep fittings against opposing sides of compact rooms, not in the aisle.
   const shelvesZ=-p.depth/2+.42;
   const stackZ=p.depth/2-.54;
   for(const x of [-.75,.75])cube(g,.09,2.12,.42,x,1.06,shelvesZ,iron);
   for(const y of [.14,.77,1.4,2.08])cube(g,1.63,.065,.46,0,y,shelvesZ,wood);
   for(let j=0;j<7;j++){
    const row=Math.floor(j/3),col=j%3;
    cube(g,.26+(j%2)*.08,.27+(j%3)*.04,.27,
     -.52+col*.5,.33+row*.63,shelvesZ,card);
   }
   const stack=new THREE.Group();stack.name='phi-backroom-cardboard-stack';stack.position.z=stackZ;g.add(stack);
   const cartons=[[-.56,0,0,.46,.03],[0,0,.04,.5,-.1],[.56,0,-.02,.42,.08],[-.52,.46,0,.42,-.07],[.02,.5,.02,.45,.06],[.55,.42,0,.43,-.04],[.02,.95,.01,.38,.12]];
   const fallback=new THREE.Group();stack.add(fallback);
   for(const [x,y,z,size,angle] of cartons){const box=cube(fallback,size,size,size,x,y+size/2,z,card);box.rotation.y=angle;}
   asset(modelURL('cardboard-boxes.glb')).then(source=>{
    if(!g.parent||g.userData.galleryDisposed)return;
    source.updateMatrixWorld(true);
    const original=source.getObjectByName('290x290x290_1_Cardboard_Box_Mat_0');if(!original)return;
    for(const [x,y,z,size,angle] of cartons){
     const mesh=original.clone();original.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);
     const box=fit(THREE,mesh,size);box.position.set(x,y,z);box.rotation.y=angle;stack.add(box);
    }
    fallback.visible=false;stack.userData.modelLoaded=true;
   }).catch(error=>console.warn('Backroom cardboard box fallback',error));
  }
 }
 return holders;
}
export function createPhiGothicEntrance(THREE,{doorway,outward,level,surroundMaterial}){
 const root=new THREE.Group();root.name='phi-gothic-main-entrance';root.position.set(doorway.x,level,doorway.z);root.rotation.y=Math.atan2(outward.x,outward.z);
 const surround=createGothicSurroundShape(THREE);
 const stone=surroundMaterial||new THREE.MeshStandardMaterial({color:'#b8b5a9',roughness:.9});
 const infill=new THREE.Mesh(new THREE.ExtrudeGeometry(surround,{depth:.26,bevelEnabled:false,steps:1}),stone);infill.position.z=-.13;infill.name='gothic-exact-arch-infill';root.add(infill);
 for(const x of [-1.46,1.46]){const jamb=new THREE.Mesh(new THREE.BoxGeometry(.28,5.2,.34),stone);jamb.position.set(x,2.6,.045);root.add(jamb);}
 const width=2.147,hinges=[new THREE.Group(),new THREE.Group()];
 const fallbackMaterial=new THREE.MeshStandardMaterial({color:'#514132',roughness:.85});
 const fallback=[];
 hinges.forEach((hinge,i)=>{hinge.position.x=(i?1:-1)*width/2;root.add(hinge);
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(width/2-.04,3.8,.09),fallbackMaterial);leaf.position.set((i?-1:1)*width/4,1.9,0);hinge.add(leaf);fallback.push(leaf);
 });
 asset(modelURL('gothic-entrance-door.glb')).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=source.clone(true);
  const fixed=model.getObjectByName('Entrance_Frame'),left=model.getObjectByName('Entrance_Left'),right=model.getObjectByName('Entrance_Right');
  if(!fixed||!left||!right)return;
  root.add(fixed);
  [left,right].forEach((leaf,i)=>{leaf.position.x-=hinges[i].position.x;hinges[i].add(leaf);fallback[i].visible=false;});
  root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Main entrance door fallback',error));
 let openness=0;
 return {root,update(dt,visitor){
  if(!root.parent)return;root.updateWorldMatrix(true,false);
  const local=root.worldToLocal(new THREE.Vector3(visitor.x,visitor.y,visitor.z));
  const target=Math.abs(local.z)<3.5&&Math.abs(local.x)<2?1:0;
  openness+=(target-openness)*Math.min(1,dt*3.2);
  hinges[0].rotation.y=-openness*1.64;hinges[1].rotation.y=openness*1.64;
  root.userData.openness=openness;
 }};
}

export const RECEPTION_CREDITS=[
 {title:'The gallery',lines:['PROPORTION PIECE','Daily generative art and architecture','','Built with Three.js','Three.js authors · MIT licence','','Visitors: Quaternius · CC0','Street lamps: Poly Haven · CC0']},
 {title:'Scene models',lines:['Door — Maria Stashko','Pothos plant — AllQuad','Reception art — PROPORTION PIECE','Magazine cabinet — JFN','Paper debris — Sousinho','Cardboard boxes —','NotAnotherApocalypticCo.','','Scene models: CC BY 4.0','Meshes and textures optimised.','Chalkboard — clon6767 · CC BY 4.0','Pub sign — johhny3D · CC BY 4.0','Window — MWOgier · CC BY 4.0','Hanging signs — Sousinho · CC BY 4.0','Fittings — dylanheyes · CC BY 4.0']},
 {title:'Materials and fittings',lines:['Wallpaper: Decorative Wall 2','ShareTextures · M. Tolga Arslan · CC0','Feature wall: Bricks055 charcoal','ambientCG · CC0','Gallery: plastered_wall_02','Poly Haven · CC0','Ceiling: OfficeCeiling001','Brick: Bricks055 · ambientCG · CC0','Roof: KSmodels · CC BY 4.0','Floor: Aman Bajwa · CC BY 4.0','Scan adapted; textures optimised.','Full credits and licences online.']}
];
export const RECEPTION_AUTHORSHIP={title:'Artistic direction',lines:[
 'Adam Clement',
 'φ is a chosen constraint.',
 'Adam shapes the rules, reviews the',
 'results and decides what to keep,',
 'change or leave out.'
]};
export function addPhiReceptionCredits(THREE,scene,placement,elevation){
 const exhibits=[];if(!placement)return exhibits;
 for(const [i,credit] of [...RECEPTION_CREDITS,RECEPTION_AUTHORSHIP].entries()){
  const authorship=credit===RECEPTION_AUTHORSHIP;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=880;const g=canvas.getContext('2d');
  g.fillStyle='#eee9dc';g.fillRect(0,0,640,880);g.fillStyle='#344638';g.font='42px "AlgoArt Marker", Georgia';g.fillText(credit.title,40,88,560);
  g.strokeStyle='#b7b4a2';g.beginPath();g.moveTo(40,120);g.lineTo(600,120);g.stroke();g.font='25px Georgia';credit.lines.forEach((line,n)=>g.fillText(line,40,185+n*Math.min(58,650/Math.max(1,credit.lines.length-1)),560));
  if(authorship){
   canvas.width=960;canvas.height=600;
   g.fillStyle='#eee9dc';g.fillRect(0,0,960,600);g.fillStyle='#344638';
   g.font='54px "AlgoArt Marker", Georgia';g.fillText(credit.title,60,100,840);
   g.strokeStyle='#b7b4a2';g.beginPath();g.moveTo(60,132);g.lineTo(900,132);g.stroke();
   g.font='42px Georgia';g.fillText(credit.lines[0],60,204,840);
   g.font='34px Georgia';credit.lines.slice(1).forEach((line,n)=>g.fillText(line,60,300+n*64,840));
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const group=new THREE.Group();group.name=authorship?'phi-reception-authorship':'phi-reception-credit-'+i;
  const width=authorship?1.05:.68,height=authorship?.65625:.94;
  const offset=authorship?0:(i-1)*.83;
  group.position.set(placement.x+(placement.axis==='z'?offset:0),elevation+(authorship?2.62:1.65),placement.z+(placement.axis==='x'?offset:0));
  group.rotation.y=placement.axis==='x'?(placement.normal.x>0?Math.PI/2:-Math.PI/2):(placement.normal.z>0?0:Math.PI);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(width+.06,height+.06,.045),new THREE.MeshStandardMaterial({color:'#3d493b',roughness:.78})));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}));face.position.z=.026;group.add(face);scene.add(group);
  exhibits.push({study:{title:credit.title,credits:credit.lines.join('\n'),image:canvas.toDataURL(),href:new URL('./credits.html',import.meta.url).href},position:group.position.clone(),normal:new THREE.Vector3(placement.normal.x,0,placement.normal.z)});
 }
 return exhibits;
}

// Backless concrete benches with restrained timber seating; the same visitor
// renderer supplies calibrated standing and seated male/female models.
export function renderPhiFurniture(THREE,parent,plan,{concrete,timber},elevation=0){
 const root=new THREE.Group();root.name='phi-minimal-furnishings';parent.add(root);
 for(const b of plan.benches){
  const group=new THREE.Group();group.position.set(b.x,elevation,b.z);group.rotation.y=b.rotation;root.add(group);
  const part=(w,h,d,x,y,z,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);group.add(m);};
  for(const x of [-.65,.65])part(.23,.45,.62,x,.225,0,concrete);
  part(1.85,.105,.68,0,.49,0,concrete);
  for(const z of [-.21,0,.21])part(1.80,.045,.185,0,.565,z,timber);
 }
 renderVisitors(THREE,root,{benches:[],people:plan.people.map(p=>({...p,y:elevation}))});
 return root;
}
export function addPhiFrontage(THREE,root,{concrete,timber,metal,defer}){
 addPhiPubSign(THREE,root);
 const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m;};
 box(2.65,.06,.65,0,-.05,.22,concrete);
 const glow=new THREE.MeshStandardMaterial({color:'#f1e9cf',emissive:'#e5c795',emissiveIntensity:.65,roughness:.3});
 const oldFixtures=[];
 for(const side of [-1,1]){
  oldFixtures.push(box(.16,.7,.22,side*1.94,2.25,.23,metal),box(.11,.52,.055,side*1.94,2.25,.37,glow));
  const lamp=new THREE.PointLight('#ffe4ba',2.3,5,2);lamp.position.set(side*1.94,2.4,.65);root.add(lamp);
 }
 if(globalThis.__phiReceptionTestRefresh)addPhiOfficeFrontage(THREE,root,oldFixtures);
 const benches=[-1,1].map(side=>({x:side*5.2,z:3.1,rotation:Math.atan2(-side*5.2,-3.1)}));
 const b=benches[0];renderPhiFurniture(THREE,root,{benches,people:[]},{concrete,timber});
 const people=()=>renderVisitors(THREE,root,{benches:[],people:[{...b,y:0,yaw:b.rotation,bodyType:'female',variant:2,scale:1,pose:4,seat:true}]});
 if(defer)defer.push(people);else people();
 return {benches:2,visitors:1};
}


export function addPhiReceptionMap(THREE,scene,placement,elevation){
 if(!placement)return null;
 const root=new THREE.Group();root.name='phi-reception-baked-watercolour';root.position.set(placement.x,elevation+placement.centreY,placement.z);
 root.rotation.y=placement.axis==='x'?(placement.normal.x>0?Math.PI/2:-Math.PI/2):(placement.normal.z>0?0:Math.PI);scene.add(root);
 // A pre-rendered editor export: no live paint simulation or GLB decode in reception.
 const frameWidth=placement.width,frameHeight=placement.height||4.016;
 const frame=new THREE.Mesh(new THREE.BoxGeometry(frameWidth,frameHeight,.08),
  new THREE.MeshStandardMaterial({color:'#302d29',roughness:.68}));
 frame.name='reception-watercolour-frame';root.add(frame);
 const mount=new THREE.Mesh(new THREE.PlaneGeometry(frameWidth-.12,frameHeight-.12),
  new THREE.MeshBasicMaterial({color:'#ede8da',toneMapped:false}));
 mount.position.z=.043;root.add(mount);
 const artHeight=frameHeight-.20,artWidth=artHeight*1.4;
 const paper=new THREE.MeshBasicMaterial({color:'#f5f0e6',toneMapped:false});
 const artwork=new THREE.Mesh(new THREE.PlaneGeometry(artWidth,artHeight),paper);
 artwork.name='reception-radiant-watercolour';artwork.position.z=.047;root.add(artwork);
 const imageURL=new URL('./assets/reception-radiant-watercolour.webp',import.meta.url).href;
 new THREE.TextureLoader().load(imageURL,texture=>{
  if(!root.parent||root.userData.galleryDisposed){texture.dispose();return;}
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  paper.map=texture;paper.color.set('#ffffff');paper.needsUpdate=true;
  root.userData.modelLoaded=true;
 },undefined,error=>console.warn('Reception baked watercolour unavailable',error));
 return root;
}
