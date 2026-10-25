// Small, softly defocused city cards: no downloaded panorama, image decoder,
// cube-map conversion or per-frame blur. One texture covers sixteen flat panels.
import {makeRandom,seedFromString} from './layout-v2.mjs';
const assets=new WeakMap();
export const BACKDROP_SEED='PP-DISTANT-CITY-01';
export function planCityBackdrop(seed=BACKDROP_SEED){
 const random=makeRandom(seedFromString(seed)),layers=[];
 for(let layer=0;layer<3;layer++){
  const buildings=[],trees=[];let x=-.025;
  while(x<1){
   const width=.011+random()*.025,height=.035+random()**1.5*(.12+layer*.014);
   buildings.push({x,width,height,base:.445+layer*.014,roof:random()<.28,windows:random()<.55,shade:random()});
   x+=width*(.75+random()*.65);
  }
  for(let i=0;i<20;i++)trees.push({x:random(),base:.46+layer*.01,width:.006+random()*.008,height:.025+random()*.035,shade:random()});
  layers.push({buildings,trees});
 }
 return {seed,layers};
}
function drawCityCanvas(plan,{lowPower=false}={}){
 const width=lowPower?512:1024,height=width/4;
 const source=document.createElement('canvas');source.width=width;source.height=height;
 const g=source.getContext('2d');
 // A hazy ground field conceals the finite terrain edge, while its lower fade
 // joins the matching colour of the sky's lower hemisphere from upper floors.
 const ground=g.createLinearGradient(0,height*.43,0,height);
 ground.addColorStop(0,'rgba(183,191,180,0)');ground.addColorStop(.12,'rgba(183,191,180,.98)');
 ground.addColorStop(.62,'rgba(183,191,180,.94)');ground.addColorStop(1,'rgba(183,191,180,0)');
 g.fillStyle=ground;g.fillRect(0,0,width,height);
 const colours=['#a8b4b6','#98a6a6','#899997'];
 for(const [index,layer] of plan.layers.entries()){
  g.globalAlpha=.40+index*.13;
  for(const b of layer.buildings)for(const wrap of [-1,0,1]){
   const x=(b.x+wrap)*width,w=b.width*width,h=b.height*height,y=(b.base-b.height)*height;
   g.fillStyle=colours[index];g.fillRect(x,y,w,h);
   // A few quiet roof slopes, end faces and window bands suggest objects
   // without spending geometry or sharp detail on distant buildings.
   if(b.roof){g.beginPath();g.moveTo(x-w*.06,y);g.lineTo(x+w*.5,y-h*.15);g.lineTo(x+w*1.06,y);g.closePath();g.fill();}
   g.fillStyle='rgba(221,226,222,.18)';g.fillRect(x+w*.70,y,w*.30,h);
   if(b.windows){g.fillStyle='rgba(66,85,89,.18)';for(let row=1;row<4;row++)g.fillRect(x+w*.16,y+h*row/5,w*.60,Math.max(.5,height*.003));}
  }
  g.fillStyle=index<2?'#9cab9e':'#849787';
  for(const t of layer.trees)for(const wrap of [-1,0,1]){
   const x=(t.x+wrap)*width,y=(t.base-t.height*.5)*height;
   g.beginPath();g.ellipse(x,y,t.width*width,t.height*height*.52,0,0,Math.PI*2);g.fill();
  }
 }
 g.globalAlpha=1;
 // Horizontal padding wraps the objects through the filter at the seam.
 const pad=12,scratch=document.createElement('canvas');scratch.width=width+pad*2;scratch.height=height+pad*2;
 const s=scratch.getContext('2d');s.drawImage(source,pad,pad);s.drawImage(source,pad-width,pad);s.drawImage(source,pad+width,pad);
 const output=document.createElement('canvas');output.width=width;output.height=height;const c=output.getContext('2d');
 c.filter='blur('+(lowPower?1:2)+'px)';c.drawImage(scratch,-pad,-pad);c.filter='none';
 return output;
}
export function addProceduralBackdrop(THREE,scene,{centerX=0,centerZ=0,groundY=0,lowPower=false}={}){
 let variants=assets.get(THREE);if(!variants){variants=new Map();assets.set(THREE,variants);}
 const key=lowPower?'mobile':'desktop',cacheHit=variants.has(key);let asset=variants.get(key);
 if(!asset){
  const started=performance.now(),plan=planCityBackdrop(),canvas=drawCityCanvas(plan,{lowPower});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.BackSide,depthWrite:false,fog:false});
  const geometry=new THREE.CylinderGeometry(150,150,120,16,1,true);
  for(const resource of [texture,material,geometry])resource.userData.galleryPersistent=true;
  asset={texture,material,geometry,width:canvas.width,height:canvas.height,objects:plan.layers.reduce((n,l)=>n+l.buildings.length+l.trees.length,0),generatedMs:performance.now()-started};
  variants.set(key,asset);
 }
 const mesh=new THREE.Mesh(asset.geometry,asset.material);mesh.name='procedural-city-backdrop';
 mesh.position.set(centerX,groundY-10,centerZ);mesh.renderOrder=-4;scene.add(mesh);
 return {source:'procedural-city',width:asset.width,height:asset.height,pixels:asset.width*asset.height,
  objects:asset.objects,triangles:32,meshCount:1,cacheHit,textureId:asset.texture.uuid,generatedMs:Math.round(asset.generatedMs*100)/100};
}
