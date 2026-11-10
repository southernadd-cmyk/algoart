// PROPORTION PIECE — painting IS the sculptural surface.
// A single material-bearing volumetric mesh, not strokes in front of a
// differently coloured sculpture. The archived raster is an actual texture
// on the front AND the shaped back. Local pigment colours finish the sides.
// The φ / golden-angle rules change the physical return geometry, not XY paint.
import * as THREE from 'three';
import {estimatePaper,pigmentOpacity} from '../visit/paper-isolation.mjs';

export const PHI=(1+Math.sqrt(5))/2;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const W=1.34,H=1.88;
export const MATERIAL_SURFACE_VERSION='paint-surface-v1';

export function pigmentField(imageData,{material='marker',paper='#f5f0e6'}={}){
  const {width:w,height:h,data}=imageData||{};
  if(!w||!h||!data||data.length<w*h*4)
    throw Error('Archived painting pixels are required for sculpture surfaces');
  const background=estimatePaper(imageData,paper);
  const raw=new Float32Array(w*h);
  const gentle=material==='tissue'||material==='watercolour';
  for(let i=0;i<raw.length;i++){
    const k=i*4,r=data[k],g=data[k+1],b=data[k+2];
    const difference=Math.max(Math.abs(r-background[0]),
      Math.abs(g-background[1]),Math.abs(b-background[2]));
    let opacity=pigmentOpacity(r,g,b,background,material)*(data[k+3]/255);
    // A translucent tissue/watercolour wash must not disappear just because
    // its RGB is relatively close to paper. Pure JPEG noise still stays out.
    if(gentle&&difference>17)
      opacity=Math.max(opacity,clamp((difference-17)/37,0,.75));
    raw[i]=opacity;
  }
  const occupancy=new Uint8Array(w*h),ink=new Float32Array(w*h);
  let cells=0,mean=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,v=raw[i];
    let neighbourMax=0,sum=0,n=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const xx=x+dx,yy=y+dy;
      if(xx<0||xx>=w||yy<0||yy>=h)continue;
      const q=raw[yy*w+xx];sum+=q;n++;
      if(dx||dy)neighbourMax=Math.max(neighbourMax,q);
    }
    // A one-pixel brush mark gets enough width to become a real round solid,
    // but blank paper elsewhere is not turned into a background sheet.
    const rounded=clamp(.60*v+.27*sum/n+.13*neighbourMax,0,1);
    ink[i]=rounded;
    if(rounded>.067){occupancy[i]=1;cells++;mean+=rounded;}
  }
  if(cells<3)throw Error('No source paint detected for volumetric sculpture');
  return {width:w,height:h,ink,occupancy,cells,meanInk:mean/cells,material};
}

export function materialFinish(material='marker'){
  switch(material){
    case 'tissue':return {roughness:.96,metalness:0,bumpScale:.009};
    case 'watercolour':return {roughness:.88,metalness:0,bumpScale:.006};
    case 'oil':return {roughness:.50,metalness:.035,bumpScale:.028};
    case 'action':return {roughness:.64,metalness:.01,bumpScale:.022};
    default:return {roughness:.76,metalness:0,bumpScale:.010};
  }
}

function buildProfile(method,u,v,ink,depth){
  // Real, variable-thickness sculpture: inner pigment is rounder/fuller than
  // the edges, which taper into genuinely modelled sidewalls and cavities.
  const x=(u-.5)*W,y=(v-.5)*H;
  const strength=Math.sqrt(clamp(ink,0,1));
  const a=GOLDEN_ANGLE*(v*PHI+u/PHI);
  const frontZ=depth*(.105+.255*strength+
    .037*Math.sin(TAU*u*PHI)*Math.sin(TAU*v/PHI));
  const backZ=-depth*(.14+.42*strength+
    .032*Math.cos(TAU*v*PHI+u*TAU));
  if(method==='petal'){
    const bend=.17*Math.sin(a*PHI);
    return [[x,y,frontZ],[x*.69+bend,y*.82+.07*Math.cos(a),backZ]];
  }
  if(method==='ribbon'){
    const angle=.27*Math.sin(v*TAU/PHI)*PHI;
    const backX=(x*Math.cos(angle)-y*.40*Math.sin(angle))*.75;
    const backY=(x*.25*Math.sin(angle)+y*Math.cos(angle))*.81;
    return [[x,y,frontZ],[backX+.07*Math.cos(a),backY,backZ*1.10]];
  }
  if(method==='pigment'){
    const lobe=.035*Math.sin(u*TAU*PHI+v*TAU);
    return [[x,y,frontZ+depth*(.08*strength+lobe)],
      [x*.85+.065*Math.sin(a),y*.85+.038*Math.cos(a),backZ*1.18]];
  }
  if(method==='hybrid'){
    return [[x,y,frontZ+depth*.025*Math.sin(a)],
      [x*.76+.14*Math.sin(a),y*.82+.06*Math.cos(a*PHI),backZ*1.12]];
  }
  throw Error('Unknown material-sculpture method '+method);
}

function localPigmentRGB(field,pixels,c,r){
  const {width:w,height:h,ink}=field;
  let best=-1,bestInk=-1;
  for(let dy=-2;dy<=1;dy++)for(let dx=-2;dx<=1;dx++){
    const x=c+dx,y=r+dy;
    if(x<0||y<0||x>=w||y>=h)continue;
    const i=y*w+x;
    if(ink[i]>bestInk){bestInk=ink[i];best=i;}
  }
  const k=4*Math.max(0,best);
  return new THREE.Color().setRGB(
    pixels.data[k]/255,pixels.data[k+1]/255,pixels.data[k+2]/255,
    THREE.SRGBColorSpace);
}

export function buildMaterialSculpture(method,imageData,texture,{
  depth=1,material='marker',paper='#f5f0e6'
}={}){
  if(!texture?.isTexture)throw Error('Actual archived artwork texture is required');
  const field=pigmentField(imageData,{material,paper});
  const w=field.width,h=field.height,stride=w+1,n=stride*(h+1);
  const position=new Float32Array(n*2*3);
  const uv=new Float32Array(n*2*2);
  const colors=new Float32Array(n*2*3);
  const nodeStrength=(c,r)=>{
    let sum=0,n=0;
    for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){
      const xx=c+dx,yy=r+dy;
      if(xx<0||yy<0||xx>=w||yy>=h)continue;
      sum+=field.ink[yy*w+xx];n++;
    }
    return n?sum/n:0;
  };
  for(let r=0;r<=h;r++)for(let c=0;c<=w;c++){
    const idx=r*stride+c,u=c/w,v=1-r/h;
    const [front,back]=buildProfile(method,u,v,nodeStrength(c,r),depth);
    const colour=localPigmentRGB(field,imageData,c,r);
    for(const [layer,point] of [[0,front],[1,back]]){
      const p=(layer*n+idx)*3,t=(layer*n+idx)*2;
      position.set(point,p);
      uv[t]=u;uv[t+1]=v;
      colors[p]=colour.r;colors[p+1]=colour.g;colors[p+2]=colour.b;
    }
  }
  const front=[],back=[],walls=[];
  const top=(c,r)=>r*stride+c,bot=(c,r)=>n+top(c,r);
  const used=(c,r)=>c>=0&&c<w&&r>=0&&r<h&&field.occupancy[r*w+c]===1;
  const wall=(a,b)=>walls.push(a,b,bot(b%stride,Math.floor(b/stride)),
    a,bot(b%stride,Math.floor(b/stride)),
    bot(a%stride,Math.floor(a/stride)));
  for(let r=0;r<h;r++)for(let c=0;c<w;c++){
    if(!used(c,r))continue;
    const tl=top(c,r),tr=top(c+1,r),bl=top(c,r+1),br=top(c+1,r+1);
    front.push(tl,bl,tr,tr,bl,br);
    back.push(bot(c,r),bot(c+1,r),bot(c,r+1),
      bot(c+1,r),bot(c+1,r+1),bot(c,r+1));
    if(!used(c,r-1))wall(tl,tr);
    if(!used(c+1,r))wall(tr,br);
    if(!used(c,r+1))wall(br,bl);
    if(!used(c-1,r))wall(bl,tl);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setIndex([...front,...back,...walls]);
  geometry.addGroup(0,front.length+back.length,0);
  geometry.addGroup(front.length+back.length,walls.length,1);
  geometry.computeVertexNormals();
  // Bump from the SAME image as the pigment colour; a material profile
  // controls relief and finish rather than replacing oil/tissue with pastel.
  const finish=materialFinish(material);
  const artworkSurface=new THREE.MeshStandardMaterial({
    map:texture,bumpMap:texture,bumpScale:finish.bumpScale,
    roughness:finish.roughness,metalness:finish.metalness,
    side:THREE.DoubleSide
  });
  const sculptedEdge=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:finish.roughness,metalness:finish.metalness,
    side:THREE.DoubleSide
  });
  for(const m of [artworkSurface,sculptedEdge])m.userData.ppOwned=true;
  const mesh=new THREE.Mesh(geometry,[artworkSurface,sculptedEdge]);
  mesh.name='Original material becomes the whole rounded 360° pigment volume';
  mesh.userData.ppOwned=true;
  const group=new THREE.Group();
  group.add(mesh);
  group.name='Source material sculpture / '+method;
  group.userData={
    engine:MATERIAL_SURFACE_VERSION,method,
    material,sourceAnchored:true,paintedCells:field.cells,
    paintedFraction:field.cells/(w*h),
    sourceTextureOnBody:mesh.material[0].map===texture,
    separatePaintingOverlay:false,
    materialRoughness:finish.roughness,materialBumpScale:finish.bumpScale,
    volumetricDepth:depth,frontIndices:front.length,
    backIndices:back.length,wallIndices:walls.length,
    sourceAnchors:[],sourceTraceCount:field.cells,
    sourceOrigin:'actual-archived-image',
    noModelInference:true,
    noImagePlane:true
  };
  return group;
}

export function disposeMaterialSculpture(group){
  if(!group)return;
  group.traverse(o=>{
    o.geometry?.dispose();
    if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])
      if(mat.userData.ppOwned)mat.dispose();
  });
  group.removeFromParent();
  group.clear();
  // Texture belongs to the image loader and is shared by all four methods.
}
