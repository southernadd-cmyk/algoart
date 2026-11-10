// PROPORTION PIECE — painting IS the sculptural surface.
// A single material-bearing volumetric mesh, not strokes in front of a
// differently coloured sculpture. The archived raster is an actual texture
// on the front AND the shaped back. Local pigment colours finish the sides.
// The φ / golden-angle rules change the physical return geometry, not XY paint.
import * as THREE from 'three';
import {estimatePaper,pigmentOpacity} from '../visit/paper-isolation.mjs';

export const PHI=(1+Math.sqrt(5))/2;
const TAU=Math.PI*2;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
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
  // Distance to paper determines the real cross-section. A fine pencil line
  // should NOT have the same front-to-back bulk as a broad oil brushstroke.
  const distance=new Float32Array(w*h);
  for(let i=0;i<distance.length;i++)distance[i]=occupancy[i]?500:0;
  const unit=1,diag=Math.SQRT2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=y*w+x;
    if(!distance[k])continue;
    if(x)distance[k]=Math.min(distance[k],distance[k-1]+unit);
    if(y)distance[k]=Math.min(distance[k],distance[k-w]+unit);
    if(x&&y)distance[k]=Math.min(distance[k],distance[k-w-1]+diag);
    if(x+1<w&&y)distance[k]=Math.min(distance[k],distance[k-w+1]+diag);
  }
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
    const k=y*w+x;
    if(!distance[k])continue;
    if(x+1<w)distance[k]=Math.min(distance[k],distance[k+1]+unit);
    if(y+1<h)distance[k]=Math.min(distance[k],distance[k+w]+unit);
    if(x+1<w&&y+1<h)distance[k]=Math.min(distance[k],distance[k+w+1]+diag);
    if(x&&y+1<h)distance[k]=Math.min(distance[k],distance[k+w-1]+diag);
  }
  return {width:w,height:h,ink,occupancy,distance,cells,meanInk:mean/cells,material};
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

// The source pigment field defines an implicit, *rounded* physical volume.
// A changing x/y inverse map develops a twisted/tapered φ-related back.
// We extract a single smooth isosurface using marching tetrahedra, not a
// front plane joined to the back by long image-stretched wall strips.
function undoBackWarp(method,x,y,z,depth){
  const t=clamp(-z/(depth*.78),0,1);
  const phase=GOLDEN_ANGLE*(y/H+.5)*PHI+x/PHI;
  let sx=1,sy=1,dx=0,dy=0;
  if(method==='petal'){
    sx=1-.23*t;sy=1-.12*t;
    dx=.19*t*Math.sin(phase*PHI);
    dy=.06*t*Math.cos(phase);
  }else if(method==='ribbon'){
    sx=1-.21*t;sy=1-.21*t;
    dx=.22*t*Math.sin(phase*1.5);
    dy=.13*t*Math.sin(phase/PHI+x*3);
  }else if(method==='pigment'){
    sx=1-.14*t;sy=1-.13*t;
    dx=.09*t*Math.sin(phase);
    dy=.065*t*Math.cos(phase*PHI);
  }else if(method==='hybrid'){
    sx=1-.19*t;sy=1-.18*t;
    dx=.15*t*Math.sin(phase*PHI)+.04*t*Math.cos(y*TAU);
    dy=.085*t*Math.cos(phase);
  }else throw Error('Unknown sculptural method '+method);
  return [(x-dx)/sx,(y-dy)/sy];
}
function fieldAt(field,method,x,y,z,depth){
  const [sx,sy]=undoBackWarp(method,x,y,z,depth);
  const u=(sx/W+.5)*field.width-.5;
  const v=(.5-sy/H)*field.height-.5;
  if(u<0||v<0||u>field.width-1||v>field.height-1)return -.7;
  const x0=Math.floor(u),y0=Math.floor(v);
  const x1=Math.min(field.width-1,x0+1),y1=Math.min(field.height-1,y0+1);
  const fx=u-x0,fy=v-y0;
  const at=(cx,cy)=>field.ink[cy*field.width+cx];
  const a=at(x0,y0)*(1-fx)+at(x1,y0)*fx;
  const b=at(x0,y1)*(1-fx)+at(x1,y1)*fx;
  const pigment=a*(1-fy)+b*fy;
  // Respect brush width: 1–2px marks become slender 3D threads while
  // wider coloured washes and oil blobs acquire substantial sculptural bulk.
  const dist=(field.distance[y0*field.width+x0]*(1-fx)+
    field.distance[y0*field.width+x1]*fx)*(1-fy)+
    (field.distance[y1*field.width+x0]*(1-fx)+
    field.distance[y1*field.width+x1]*fx)*fy;
  const localWidth=Math.min(9,Math.max(0,dist));
  const range=z>=0?.10+.048*localWidth:.14+.055*localWidth;
  const profile=z/(range*depth);
  const thickness=method==='pigment'?.60:method==='ribbon'?.76:.69;
  return pigment-.092-thickness*profile*profile;
}
export function buildMaterialSculpture(method,imageData,texture,{
  depth=1,material='marker',paper='#f5f0e6',quality='desktop'
}={}){
  if(!texture?.isTexture)throw Error('Actual archived artwork texture is required');
  if(!['petal','ribbon','pigment','hybrid'].includes(method))
    throw Error('Unsupported 360° sculpting method '+method);
  const field=pigmentField(imageData,{material,paper});
  const mobile=quality==='mobile';
  const nx=mobile?60:82,ny=mobile?88:116,nz=mobile?17:20;
  const sizex=1.88,sizey=2.35;
  const plane=(nx+1)*(ny+1);
  const count=plane*(nz+1);
  const scalars=new Float32Array(count);
  const gx=(i)=>(i/nx-.5)*sizex;
  const gy=(j)=>(.5-j/ny)*sizey;
  const gz=(k)=>(-.79+k/nz*1.42)*depth;
  const idx=(i,j,k)=>k*plane+j*(nx+1)+i;
  for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)
    scalars[idx(i,j,k)]=fieldAt(field,method,gx(i),gy(j),gz(k),depth);
  // One derivative calculation per grid vertex (rather than six expensive
  // trilinear source samples for EACH output triangle vertex). Smooth normals
  // interpolate across the tetrahedra so the painted mass has no faceting.
  const gridNormals=new Float32Array(count*3);
  const ddx=sizex/nx,ddy=sizey/ny,ddz=1.42*depth/nz;
  for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const lowX=scalars[idx(Math.max(i-1,0),j,k)];
    const highX=scalars[idx(Math.min(i+1,nx),j,k)];
    const lowY=scalars[idx(i,Math.max(j-1,0),k)];
    const highY=scalars[idx(i,Math.min(j+1,ny),k)];
    const lowZ=scalars[idx(i,j,Math.max(k-1,0))];
    const highZ=scalars[idx(i,j,Math.min(k+1,nz))];
    const xx=-(highX-lowX)/((i===0||i===nx)?ddx:2*ddx);
    const yy=(highY-lowY)/((j===0||j===ny)?ddy:2*ddy);
    const zz=-(highZ-lowZ)/((k===0||k===nz)?ddz:2*ddz);
    const len=Math.hypot(xx,yy,zz)||1;
    gridNormals.set([xx/len,yy/len,zz/len],idx(i,j,k)*3);
  }
  const positions=[],normals=[],uvs=[];
  const sides={front:0,back:0,side:0};
  const corners=[
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ];
  // Tetrahedra split one cube without any ambiguous marching-cubes cases.
  const tetra=[
    [0,5,1,6],[0,1,2,6],[0,2,3,6],
    [0,3,7,6],[0,7,4,6],[0,4,5,6]
  ];
  const interpolated=(a,b)=>{
    const denom=a.value-b.value;
    const t=clamp(Math.abs(denom)<1e-8?.5:a.value/denom,0,1);
    const nx=a.normal[0]+(b.normal[0]-a.normal[0])*t;
    const ny=a.normal[1]+(b.normal[1]-a.normal[1])*t;
    const nz=a.normal[2]+(b.normal[2]-a.normal[2])*t;
    const len=Math.hypot(nx,ny,nz)||1;
    return {
      point:[a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t],
      normal:[nx/len,ny/len,nz/len]
    };
  };
  const emit=(points)=>{
    const shades=points.map(p=>p.normal);
    const av=[shades.reduce((s,n)=>s+n[0],0),
      shades.reduce((s,n)=>s+n[1],0),
      shades.reduce((s,n)=>s+n[2],0)];
    const aa=new THREE.Vector3(...points[0].point),
      bb=new THREE.Vector3(...points[1].point),
      cc=new THREE.Vector3(...points[2].point);
    const cross=bb.sub(aa).cross(cc.sub(aa));
    if(cross.x*av[0]+cross.y*av[1]+cross.z*av[2]<0)
      [points[1],points[2]]=[points[2],points[1]];
    for(let q=0;q<3;q++){
      const [x,y,z]=points[q].point;
      const [sx,sy]=undoBackWarp(method,x,y,z,depth);
      positions.push(x,y,z);normals.push(...points[q].normal);
      uvs.push(clamp(sx/W+.5,0,1),clamp(sy/H+.5,0,1));
    }
    if(av[2]>.95)sides.front++;
    else if(av[2]<-.95)sides.back++;
    else sides.side++;
  };
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const cells=corners.map(([di,dj,dk])=>{
      const index=idx(i+di,j+dj,k+dk);
      return {
        x:gx(i+di),y:gy(j+dj),z:gz(k+dk),
        value:scalars[index],
        normal:gridNormals.subarray(index*3,index*3+3)
      };
    });
    let anyIn=false,anyOut=false;
    for(const c of cells){if(c.value>0)anyIn=true;else anyOut=true;}
    if(!(anyIn&&anyOut))continue;
    for(const tet of tetra){
      const inside=tet.filter(t=>cells[t].value>0);
      const outside=tet.filter(t=>cells[t].value<=0);
      if(!inside.length||!outside.length)continue;
      const cross=(a,b)=>interpolated(cells[a],cells[b]);
      if(inside.length===1){
        emit(outside.map(t=>cross(inside[0],t)));
      }else if(inside.length===3){
        emit(inside.map(t=>cross(t,outside[0])));
      }else{
        const a=cross(inside[0],outside[0]);
        const b=cross(inside[0],outside[1]);
        const c=cross(inside[1],outside[0]);
        const d=cross(inside[1],outside[1]);
        emit([a,b,c]);emit([b,d,c]);
      }
    }
  }
  if(positions.length<90)throw Error('Source pigment created no closed sculptural mass');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  const finish=materialFinish(material);
  const artworkMaterial=new THREE.MeshStandardMaterial({
    map:texture,bumpMap:texture,bumpScale:finish.bumpScale,
    roughness:finish.roughness,metalness:finish.metalness,
    side:THREE.DoubleSide
  });
  artworkMaterial.userData.ppOwned=true;
  const mesh=new THREE.Mesh(geometry,artworkMaterial);
  mesh.name='One continuous paint-textured rounded isosurface; 360° original pigment';
  mesh.userData.ppOwned=true;
  const group=new THREE.Group();
  group.add(mesh);
  group.name='Source material sculpted in the round / '+method;
  group.userData={
    engine:MATERIAL_SURFACE_VERSION,method,
    material,sourceAnchored:true,paintedCells:field.cells,
    paintedFraction:field.cells/(field.width*field.height),
    sourceTextureOnBody:mesh.material.map===texture,
    separatePaintingOverlay:false,
    materialRoughness:finish.roughness,materialBumpScale:finish.bumpScale,
    volumetricDepth:depth,frontIndices:sides.front*3,
    backIndices:sides.back*3,wallIndices:sides.side*3,
    sourceAnchors:[],sourceTraceCount:field.cells,
    sourceOrigin:'actual-archived-image',
    noModelInference:true,noImagePlane:true,
    curvedSurfaceTriangles:positions.length/9
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
