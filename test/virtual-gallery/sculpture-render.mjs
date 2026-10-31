import * as THREE from 'three';
import {
  planSculptureLayers,PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT,
  SCULPTURE_WIDTH,SCULPTURE_HEIGHT
} from './sculptures.mjs';
import {makeRandom} from './layout-v2.mjs';

const plinthMaterial=new THREE.MeshStandardMaterial({color:'#e3dfd5',roughness:.87});
const shadowMaterial=new THREE.MeshBasicMaterial({color:'#33342f',transparent:true,opacity:.11,depthWrite:false});
const edgeMaterial=new THREE.MeshStandardMaterial({color:'#66685e',metalness:.58,roughness:.56});
const backingMaterial=new THREE.MeshStandardMaterial({color:'#f0e9db',roughness:.82,side:THREE.DoubleSide});
const sliceGeo=new THREE.PlaneGeometry(SCULPTURE_WIDTH,SCULPTURE_HEIGHT);
const supportGeo=new THREE.CylinderGeometry(.011,.011,SCULPTURE_HEIGHT,5);

function maskImage(ctx,form,layer,width,height){
  const rng=makeRandom(layer.maskSeed);
  const W=width,H=height;
  const f=()=>rng();
  ctx.beginPath();
  if(layer.isBacking){
    ctx.rect(0,0,W,H);
    ctx.fill();
    return;
  }
  if(form==='strata'||form==='blocks'){
    for(let i=0;i<4;i++){
      const x=W*(.05+f()*.70),y=H*(.02+f()*.80);
      const w=W*(.13+f()*.30),h=H*(.08+f()*.28);
      ctx.rect(x,y,w,h);
    }
    if(form==='blocks'){ctx.moveTo(W*.12,H*.9);ctx.lineTo(W*(.4+f()*.25),H*.56);ctx.lineTo(W*.72,H*.85);ctx.closePath();}
  } else if(form==='ribbon'||form==='gestural'||form==='growth'){
    const count=form==='gestural'?5:form==='growth'?4:3;
    for(let i=0;i<count;i++){
      ctx.lineWidth=W*(form==='growth'?.12:.17);
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.moveTo(W*(.13+f()*.72),-H*.07);
      ctx.bezierCurveTo(W*(f()*1.2-.1),H*(.18+f()*.18),
        W*(f()*1.2-.1),H*(.65+f()*.12),W*(.1+f()*.85),H*1.07);
      ctx.stroke();
      ctx.beginPath();
    }
  } else if(form==='lattice'){
    for(let i=0;i<5;i++){
      ctx.lineWidth=W*(.085+f()*.065);ctx.lineCap='round';
      const x1=W*f(),y1=H*f(),x2=W*f(),y2=H*f();
      ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      ctx.beginPath();ctx.arc(x1,y1,W*(.07+f()*.12),0,Math.PI*2);ctx.fill();ctx.beginPath();
    }
  } else if(form==='radiant'){
    const cx=W*(.34+f()*.32),cy=H*(.34+f()*.32);
    for(let i=0;i<5;i++){
      const a=f()*Math.PI*2,r=W*(.8+f()*.6),spread=.10+f()*.19;
      ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a-spread)*r,cy+Math.sin(a-spread)*r);
      ctx.lineTo(cx+Math.cos(a+spread)*r,cy+Math.sin(a+spread)*r);ctx.closePath();
    }
  } else {
    for(let i=0;i<4;i++){
      ctx.ellipse(W*(.2+f()*.6),H*(.12+f()*.76),
        W*(.10+f()*.22),H*(.08+f()*.18),f()*Math.PI,0,Math.PI*2);
    }
  }
  ctx.fill();
}
function createMaskedTexture(image,layer,quality) {
  // Each sheet repeats the *actual artwork*, but is die-cut according to the
  // source composition engine. This is reinterpretation, not inferred 3D depth.
  const maxWidth=quality==='mobile'?224:quality==='vr'?256:368;
  const canvas=document.createElement('canvas');
  canvas.width=maxWidth;
  canvas.height=Math.round(maxWidth*image.naturalHeight/image.naturalWidth);
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  // Combine all cutouts on a separate transparent mask first. Applying
  // destination-in repeatedly would INTERSECT each stroke instead of unioning
  // them and can make sculptures look mysteriously blank.
  const mask=document.createElement('canvas');
  mask.width=canvas.width;mask.height=canvas.height;
  const cut=mask.getContext('2d',{alpha:true});
  cut.fillStyle=layer.isBacking?'rgba(255,255,255,.60)':'rgba(255,255,255,.94)';
  cut.strokeStyle=cut.fillStyle;
  maskImage(cut,layer.form,layer,canvas.width,canvas.height);
  ctx.globalCompositeOperation='destination-in';
  ctx.drawImage(mask,0,0);
  ctx.globalCompositeOperation='source-over';
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  return texture;
}
function slab(w,h,d,x,y,z,material){
  const item=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  item.position.set(x,y,z);
  return item;
}

// The pivot's local +Z faces into the room. 3D glass/image strata sit above
// a grounded plinth; walking around them reveals their physical spacing.
export function createPortraitSculpture({scene,study,placement,quality,labelTexture}){
  const pivot=new THREE.Group();
  pivot.name='Portrait sculpture: '+study.seed;
  pivot.position.set(placement.x,placement.y,placement.z);
  pivot.rotation.y=placement.yaw;
  scene.add(pivot);
  const plinth=slab(PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH,
    0,PEDESTAL_HEIGHT/2,0,plinthMaterial);
  pivot.add(plinth);
  pivot.add(slab(PEDESTAL_WIDTH+.045,.044,PEDESTAL_DEPTH+.045,
    0,PEDESTAL_HEIGHT+.01,0,edgeMaterial));
  const shade=new THREE.Mesh(new THREE.PlaneGeometry(2.1,2.1),shadowMaterial);
  shade.rotation.x=-Math.PI/2;
  shade.position.set(0,.012,0);
  pivot.add(shade);
  const captionTex=labelTexture(study.title,study.seed);
  const caption=new THREE.Mesh(new THREE.PlaneGeometry(1.18,.275),
    new THREE.MeshBasicMaterial({map:captionTex,side:THREE.DoubleSide}));
  caption.position.set(0,.43,PEDESTAL_DEPTH/2+.018);
  pivot.add(caption);

  const specs=planSculptureLayers(study,quality);
  const selectable=[];
  const y=PEDESTAL_HEIGHT+.11+SCULPTURE_HEIGHT/2;
  const backing=slab(SCULPTURE_WIDTH*.96,SCULPTURE_HEIGHT*.98,.03,
    0,y,-.33,backingMaterial);
  pivot.add(backing);
  // A minimal metal armature keeps the layered object legible in profile.
  for(const x of [-SCULPTURE_WIDTH*.44,SCULPTURE_WIDTH*.44]){
    const rod=new THREE.Mesh(supportGeo,edgeMaterial);
    rod.position.set(x,y,-.27);
    pivot.add(rod);
  }
  // Even before textures have arrived, the sculpture is spatially present.
  const layers=specs.map(spec=>{
    const material=new THREE.MeshBasicMaterial({
      side:THREE.DoubleSide,transparent:true,opacity:spec.alpha,depthWrite:false,
      color:spec.isBacking?'#e7e0d3':'#f2eee5',alphaTest:.06
    });
    const mesh=new THREE.Mesh(sliceGeo,material);
    mesh.position.set(spec.shiftX,y+spec.shiftY,spec.depth);
    mesh.rotation.y=spec.turn;
    mesh.userData.study=study;
    mesh.renderOrder=spec.index+1;
    pivot.add(mesh);
    selectable.push(mesh);
    return {mesh,material,spec};
  });
  const img=new Image();
  img.decoding='async';
  img.onload=()=>{
    for(const {material,spec} of layers){
      material.map=createMaskedTexture(img,spec,quality);
      material.color.set('#ffffff');
      material.needsUpdate=true;
    }
  };
  img.onerror=()=>{console.warn('Unable to load sculpture image',study.image);};
  img.src=study.image;
  return {pivot,selectable,study};
}
