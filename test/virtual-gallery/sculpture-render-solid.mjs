import * as THREE from 'three';
import {sculptureFragments} from './sculpture-solids.mjs';
import {
  PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT,
  SCULPTURE_WIDTH,SCULPTURE_HEIGHT
} from './sculptures.mjs';

// Material and geometry are shared wherever possible to keep mobile/WebXR
// viable. Unlike v1, there are no image planes anywhere in the sculpture.
const plinthMaterial=new THREE.MeshStandardMaterial({color:'#d5d1c4',roughness:.85});
const rimMaterial=new THREE.MeshStandardMaterial({color:'#373d38',roughness:.46,metalness:.37});
const sculptureDefault=new THREE.MeshStandardMaterial({color:'#85877d',roughness:.62,metalness:.06});
const metalMaterial=new THREE.MeshStandardMaterial({color:'#5e6157',roughness:.47,metalness:.5});
const plaqueMaterial=new THREE.MeshStandardMaterial({color:'#eae6db',roughness:.92});

function block(w,h,d,material){
  return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
}
function makePlinth(pivot,study,labelTexture){
  const body=block(PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH,plinthMaterial);
  body.position.y=PEDESTAL_HEIGHT/2;
  pivot.add(body);
  const cap=block(PEDESTAL_WIDTH+.03,.034,PEDESTAL_DEPTH+.03,rimMaterial);
  cap.position.y=PEDESTAL_HEIGHT+.005;
  pivot.add(cap);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.27),
    new THREE.MeshBasicMaterial({map:labelTexture(study.title,study.seed)}));
  label.position.set(0,.38,PEDESTAL_DEPTH/2+.003);
  pivot.add(label);
}

function canvasFromImage(img,quality){
  const canvas=document.createElement('canvas');
  const bound=quality==='mobile'?512:quality==='vr'?640:896;
  const scale=Math.min(1,bound/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(2,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(2,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return {canvas,pixels:ctx.getImageData(0,0,canvas.width,canvas.height)};
}
function sampleAt(imageData,u,v){
  const x=Math.min(imageData.width-1,Math.max(0,Math.floor(u*imageData.width)));
  const y=Math.min(imageData.height-1,Math.max(0,Math.floor(v*imageData.height)));
  const k=(y*imageData.width+x)*4,d=imageData.data;
  return [d[k],d[k+1],d[k+2]];
}
function sampleColour(imageData,fragment){
  const c=fragment.cell;
  let r=0,g=0,b=0,ink=0,total=0;
  const paper=sampleAt(imageData,.02,.02);
  for(let iy=1;iy<=6;iy++)for(let ix=1;ix<=5;ix++){
    const x=c.x+c.w*ix/6,y=c.y+c.h*iy/7;
    const p=sampleAt(imageData,
      x/SCULPTURE_WIDTH+.5,.5-y/SCULPTURE_HEIGHT);
    const diff=Math.max(
      Math.abs(p[0]-paper[0]),Math.abs(p[1]-paper[1]),Math.abs(p[2]-paper[2]));
    // Prefer actual pigments to flat paper when colouring the solid sides.
    const weight=.15+Math.min(1,diff/110);
    r+=p[0]*weight;g+=p[1]*weight;b+=p[2]*weight;total+=weight;
    ink+=Math.min(1,diff/90);
  }
  return {
    rgb:[r/total,g/total,b/total],
    activity:ink/30
  };
}

function makeSolid(fragment,faceMaterial,sideColor,study){
  const shape=new THREE.Shape();
  const vertices=fragment.vertices;
  shape.moveTo(vertices[0].x,vertices[0].y);
  for(let i=1;i<vertices.length;i++)shape.lineTo(vertices[i].x,vertices[i].y);
  shape.closePath();

  const depth=fragment.depth;
  const geom=new THREE.ExtrudeGeometry(shape,{
    depth,steps:1,bevelEnabled:true,bevelThickness:.012,bevelSize:.01,
    bevelSegments:1,curveSegments:6
  });

  // ExtrudeGeometry caps use material 0; sides and bevels use material 1.
  // One full source atlas is shared, but every cap samples only the fragment's
  // actual 2-D position. There is no repeated full-picture transparency.
  const uv=geom.getAttribute('uv');
  const positions=geom.getAttribute('position');
  for(let i=0;i<uv.count;i++){
    const x=positions.getX(i),y=positions.getY(i);
    uv.setXY(i,x/SCULPTURE_WIDTH+.5,y/SCULPTURE_HEIGHT+.5);
  }
  uv.needsUpdate=true;
  // Rotate each chunk around its own centre, not around the whole portrait.
  geom.translate(-fragment.x,-fragment.y,-depth*.5);

  const color=new THREE.Color().setRGB(
    sideColor[0]/255,sideColor[1]/255,sideColor[2]/255,THREE.SRGBColorSpace
  );
  // More contrast on side faces than on the artwork's original paper surface.
  color.multiplyScalar(.58);
  const side=new THREE.MeshStandardMaterial({
    color,roughness:.70,metalness:.04
  });
  const mesh=new THREE.Mesh(geom,[faceMaterial,side]);
  mesh.position.set(fragment.x,fragment.y,fragment.z);
  mesh.rotation.set(fragment.tiltX,fragment.tiltY,fragment.roll);
  mesh.userData.study=study;
  return mesh;
}

export function createPortraitSculpture({scene,study,placement,quality,labelTexture,onArtworkMesh}){
  const pivot=new THREE.Group();
  pivot.name='Solid portrait sculpture: '+study.seed;
  pivot.position.set(placement.x,placement.y,placement.z);
  pivot.rotation.y=placement.yaw;
  scene.add(pivot);
  makePlinth(pivot,study,labelTexture);
  const selectable=[];
  const core=new THREE.Group();
  core.position.y=PEDESTAL_HEIGHT+.17+SCULPTURE_HEIGHT/2;
  pivot.add(core);

  // Show a small metallic skeletal core while the image loads; do not show
  // either a flat portrait or a stack of picture planes as a placeholder.
  const stem=block(.045,SCULPTURE_HEIGHT*.72,.055,metalMaterial);
  core.add(stem);
  const foot=block(.47,.065,.41,metalMaterial);
  foot.position.y=-SCULPTURE_HEIGHT/2+.01;
  core.add(foot);

  const img=new Image();
  img.decoding='async';
  img.onload=()=>{
    try {
      const {canvas,pixels}=canvasFromImage(img,quality);
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=2;
      const faceMaterial=new THREE.MeshStandardMaterial({
        map:texture,roughness:.81,metalness:0,side:THREE.DoubleSide
      });
      const fragments=sculptureFragments(study,quality);
      const tinted=fragments.map(f=>({...f,...sampleColour(pixels,f)}));
      const enough=quality==='mobile'?9:quality==='vr'?10:13;
      // Intentional spaces between solid fragments keep light passing through.
      // Prefer richly coloured/marked parts of the original portrait.
      const ranked=[...tinted].sort((a,b)=>b.activity-a.activity||a.index-b.index);
      const selected=new Set(ranked.slice(0,Math.min(enough,tinted.length)).map(p=>p.index));
      for(const fragment of tinted) {
        if(!selected.has(fragment.index))continue;
        const piece=makeSolid(fragment,faceMaterial,fragment.rgb,study);
        core.add(piece);
        selectable.push(piece);
        onArtworkMesh?.(piece);
      }
      // Replace scaffolding when the actual sculpture is assembled.
      stem.visible=false;
      foot.visible=false;
    } catch(error) {
      console.error('Unable to generate solid sculpture',study.seed,error);
      // Expose meaningful geometry as fallback without substituting pictures.
      const fallback=block(.76,1.45,.53,sculptureDefault);
      core.add(fallback);
      fallback.userData.study=study;
      selectable.push(fallback);
      onArtworkMesh?.(fallback);
      stem.visible=false;
      foot.visible=false;
    }
  };
  img.onerror=()=>{
    console.warn('Sculpture image could not be loaded:',study.image);
    const fallback=block(.72,1.5,.52,sculptureDefault);
    fallback.userData.study=study;
    core.add(fallback);
    selectable.push(fallback);
      onArtworkMesh?.(fallback);
    stem.visible=false;foot.visible=false;
  };
  img.src=study.image;
  return {pivot,selectable,study};
}
