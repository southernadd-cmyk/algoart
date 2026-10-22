// Procedural exterior for the daily museum. Small draw-call budget: one
// terrain mesh, one sky shell and batched instanced plants/stone.
import {buildEnvironmentPlan} from './environment-v1.mjs';

const PALETTES={
  meadow:{horizon:'#cbd5cc',zenith:'#b1c8cf',terrain:['#7c9077','#9eab86','#71856e'],trees:['#536d54','#667b58','#79906b'],stone:['#b2b3a6','#9b9f91']},
  heath:{horizon:'#d4cdbf',zenith:'#b1c6cc',terrain:['#918d73','#b0a785','#7d896f'],trees:['#61705b','#758168','#8e997b'],stone:['#b6aea0','#999b8e']},
  grove:{horizon:'#cbd5cc',zenith:'#abc7cc',terrain:['#768978','#99a58a','#6e8277'],trees:['#496856','#5f7c62','#849b7c'],stone:['#b5b4ac','#949e97']},
  urban:{horizon:'#c9d0d1',zenith:'#b9cbd4',terrain:['#90928b','#a9aaa0','#80837d'],trees:['#5b735f','#72826c','#889383'],stone:['#b1b1a9','#90948e']}
};

// Offline-safe procedural exterior textures; seeded architecture retains stable
// materials even when third-party texture CDNs are unavailable.
function surfaceTexture(THREE,kind){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d'),hash=(x,y)=>(Math.imul(x+31,73856093)^Math.imul(y+17,19349663))>>>0;
  const base=kind==='brick'?'#b8a99a':kind==='concrete'?'#b6b8b1':kind==='windows'?'#bfc4c0':kind==='roof'?'#757c7a':'#93968b';
  ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
  if(kind==='brick'){
    ctx.strokeStyle='rgba(65,58,49,.35)';ctx.lineWidth=3;
    for(let y=0;y<256;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();
      for(let x=(Math.floor(y/22)%2)*30-60;x<300;x+=60){
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+22);ctx.stroke();
      }
    }
  }else if(kind==='windows'){
    for(let y=13;y<256;y+=52)for(let x=14;x<256;x+=51){
      ctx.fillStyle='#555d5c';ctx.fillRect(x-4,y-4,37,38);
      ctx.fillStyle=((hash(x,y)%3)===0)?'#aeb5ad':'#536b73';
      ctx.fillRect(x,y,29,30);
      ctx.fillStyle='rgba(224,231,222,.22)';ctx.fillRect(x+2,y+2,5,25);
      ctx.fillStyle='#959d9b';ctx.fillRect(x+14,y,2,30);
    }
  }else if(kind==='roof'){
    ctx.strokeStyle='rgba(28,37,39,.28)';ctx.lineWidth=2;
    for(let y=0;y<256;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
    for(let x=0;x<256;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
  }else if(kind==='ground'){
    ctx.strokeStyle='rgba(54,59,56,.21)';ctx.lineWidth=2;
    for(let y=0;y<256;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
    for(let x=0;x<256;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
  }
  for(let y=0;y<256;y+=2)for(let x=0;x<256;x+=2){
    const h=hash(x,y),level=(h%21)/100;
    ctx.fillStyle=(h&1)?'rgba(255,255,255,'+level+')':'rgba(28,28,23,'+(level*.58)+')';
    ctx.fillRect(x,y,2,2);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=2;
  return texture;
}
function uvBox(THREE,w,h,d,tile=2.5){
  const geo=new THREE.BoxGeometry(w,h,d),uv=geo.getAttribute('uv');
  const faces=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let side=0;side<6;side++)for(let i=0;i<4;i++){
    const k=side*4+i;
    uv.setXY(k,uv.getX(k)*faces[side][0]/tile,uv.getY(k)*faces[side][1]/tile);
  }
  uv.needsUpdate=true;return geo;
}

const noise=(a,b,s)=>Math.sin(a*.27+s)*Math.cos(b*.31-s);
export function createExteriorLandscape(THREE,scene,layout,studies,{lowPower=false}={}){
  const plan=buildEnvironmentPlan(layout,studies,{lowPower});
  const palette=PALETTES[plan.theme];
  const color=s=>new THREE.Color(s);
  const terrainColors=palette.terrain.map(color);
  // The coloured sky is a real enclosing background, not a flat fog-coloured void.
  // Back-facing vertex-coloured shell has no image requests or GPU shader dependencies.
  const skyGeo=new THREE.SphereGeometry(178,32,18);
  const skyPos=skyGeo.getAttribute('position');
  const skyColors=new Float32Array(skyPos.count*3);
  const zenith=color(palette.zenith),horizon=color(palette.horizon);
  const skyC=new THREE.Color();
  for(let i=0;i<skyPos.count;i++){
    const y=skyPos.getY(i)/178;
    skyC.copy(horizon).lerp(zenith,Math.max(0,y)*.8);
    if(y<0)skyC.lerp(color('#b7bfb4'),Math.min(1,-y));
    skyColors[i*3]=skyC.r;skyColors[i*3+1]=skyC.g;skyColors[i*3+2]=skyC.b;
  }
  skyGeo.setAttribute('color',new THREE.BufferAttribute(skyColors,3));
  // High-altitude cloud texture, deterministic for the daily seed. It is
  // local and cached in a canvas: no network dependency on a sky provider.
  const cloudCanvas=document.createElement('canvas');
  cloudCanvas.width=384;cloudCanvas.height=192;
  const cloudCtx=cloudCanvas.getContext('2d');
  const img=cloudCtx.createImageData(384,192);
  const hash=(x,y,k)=>{let n=Math.imul(x+1301,374761393)+Math.imul(y+733,668265263)+k;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const noise2=(x,y,k)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const a=hash(ix,iy,k)*(1-sx)+hash(ix+1,iy,k)*sx;
    const b=hash(ix,iy+1,k)*(1-sx)+hash(ix+1,iy+1,k)*sx;
    return a*(1-sy)+b*sy;
  };
  for(let y=0;y<192;y++)for(let x=0;x<384;x++){
    const lat=y/191;
    // Latitude zero is zenith in this projection; avoid clouding the horizon.
    const band=Math.sin(Math.PI*Math.max(0,Math.min(1,(lat-.08)/.86)));
    const n=.53*noise2(x/66,y/42,plan.seed)+.31*noise2(x/27,y/21,plan.seed)+.16*noise2(x/9,y/9,plan.seed);
    const alpha=Math.pow(Math.max(0,(n-.46)/.30),1.4)*.55*Math.max(0,band);
    const idx=(y*384+x)*4;
    img.data[idx]=247;img.data[idx+1]=247;img.data[idx+2]=242;
    img.data[idx+3]=Math.floor(Math.min(.7,alpha)*255);
  }
  cloudCtx.putImageData(img,0,0);
  const cloudMap=new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace=THREE.SRGBColorSpace;
  cloudMap.wrapS=THREE.RepeatWrapping;
  const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({
    vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false
  }));
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(176.8,40,22),
    new THREE.MeshBasicMaterial({map:cloudMap,transparent:true,side:THREE.BackSide,depthWrite:false,fog:false}));
  sky.position.set(plan.centerX,layout.rooms[0].y,plan.centerZ);
  sky.renderOrder=-5;
  scene.add(sky);
  clouds.position.copy(sky.position);
  scene.add(clouds);
  scene.background=color(palette.horizon);
  scene.fog=new THREE.Fog(color(palette.horizon),75,Math.max(164,layout.rooms[0].y+230));

  // Terrain gently rises only outside the actual footprint and approach bridges.
  // Heights are sampled from the SAME function as all the planted instances.
  const segments=lowPower?48:76;
  const groundGeo=new THREE.PlaneGeometry(plan.size,plan.size,segments,segments);
  groundGeo.rotateX(-Math.PI/2);
  const position=groundGeo.getAttribute('position');
  const groundColors=new Float32Array(position.count*3);
  const grass=new THREE.Color();
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)+plan.centerX,z=position.getZ(i)+plan.centerZ;
    position.setY(i,plan.heightAt(x,z));
    const variation=Math.sin(x*.16+plan.phase)*Math.cos(z*.13+plan.slope);
    const detail=noise(x,z,plan.phase);
    const t=Math.max(0,Math.min(1,.5+variation*.29+detail*.10));
    grass.copy(terrainColors[0]).lerp(terrainColors[1],t);
    if(variation<-.48)grass.lerp(terrainColors[2],(-variation-.48)*.44);
    groundColors[i*3]=grass.r;groundColors[i*3+1]=grass.g;groundColors[i*3+2]=grass.b;
  }
  position.needsUpdate=true;
  groundGeo.setAttribute('color',new THREE.BufferAttribute(groundColors,3));
  groundGeo.computeVertexNormals();
  const groundMap=surfaceTexture(THREE,'ground');
  groundMap.repeat.set(plan.size/12,plan.size/12);
  const ground=new THREE.Mesh(groundGeo,new THREE.MeshLambertMaterial({vertexColors:true,map:groundMap,side:THREE.DoubleSide}));
  ground.position.set(plan.centerX,0,plan.centerZ);
  scene.add(ground);

  // Ground-floor civic forecourt: wide unobstructed centre and furnished edges.
  if(plan.plaza){
    const p=plan.plaza;
    const square=new THREE.Group();
    const paving=new THREE.MeshStandardMaterial({color:'#dad6cd',roughness:.94});
    const stoneEdge=new THREE.MeshStandardMaterial({color:'#b8b6ad',roughness:.9});
    const bronze=new THREE.MeshStandardMaterial({color:'#424a49',metalness:.42,roughness:.52});
    const planted=new THREE.MeshStandardMaterial({color:'#58705c',roughness:1,flatShading:true});
    const lampGlass=new THREE.MeshStandardMaterial({color:'#f5e8cc',emissive:'#e9c99b',emissiveIntensity:.52,roughness:.36});
    const at=(along,across,y=0)=>({
      x:p.centre.x+p.outward.x*along+p.transverse.x*across,
      z:p.centre.z+p.outward.z*along+p.transverse.z*across,
      y:p.level+y
    });
    const box=(w,h,d,along,across,y,material)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.rotation.y=Math.atan2(p.outward.x,p.outward.z);
      mesh.position.copy(at(along,across,y));square.add(mesh);
      return mesh;
    };
    // Slab is deliberately below the pre-existing entrance walkway, which
    // remains the unobstructed and collision-tested visitor route.
    box(p.halfWidth*2,.16,p.halfDepth*2,0,0,-.17,paving);
    // Fine architectural joints rather than thousands of individual tiles.
    for(let a=-p.halfDepth+4;a<p.halfDepth;a+=4){
      box(p.halfWidth*2,.009,.022,a,0,-.083,stoneEdge);
    }
    for(let a=-p.halfWidth+4;a<p.halfWidth;a+=4){
      box(.022,.009,p.halfDepth*2,0,a,-.083,stoneEdge);
    }
    for(const side of [-1,1]){
      // Furnish only the perimeter: clear sightline to the gallery entrance.
      for(const along of [-9,6,13]){
        const across=side*(p.halfWidth-2.2);
        box(2.7,.57,1.2,along,across,.20,stoneEdge);
        box(2.35,.13,.92,along,across,.55,paving);
      }
      for(const along of [-13,12]){
        const across=side*(p.halfWidth-4.6);
        box(1.75,.69,1.75,along,across,.22,stoneEdge);
        const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.82,1),planted);
        shrub.position.copy(at(along,across,1.11));square.add(shrub);
      }
      for(const along of [-15,0,15]){
        const across=side*(p.halfWidth-1.5);
        box(.14,3.8,.14,along,across,1.83,bronze);
        box(.42,.38,.42,along,across,3.91,lampGlass);
      }
      box(p.halfWidth*2,.22,.34,side*(p.halfDepth-.42),0,-.01,stoneEdge);
    }
    scene.add(square);
  }

  const dummy=new THREE.Object3D();
  const greens=palette.trees.map(color);
  const stones=palette.stone.map(color);
  const place=(positions,geometry,material,transform,tint)=>{
    if(!positions.length)return;
    const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
    mesh.frustumCulled=false; // small instance count; avoid incorrect whole-batch culling
    for(let i=0;i<positions.length;i++){
      const p=positions[i];
      dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
      transform(dummy,p);
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
      if(tint)mesh.setColorAt(i,tint(p,i));
    }
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    scene.add(mesh);
    return mesh;
  };
  const trunkMaterial=new THREE.MeshLambertMaterial({color:'#767263'});
  const foliageMaterial=new THREE.MeshLambertMaterial({color:'#ffffff',flatShading:true});
  const stoneMaterial=new THREE.MeshLambertMaterial({color:'#ffffff',flatShading:true});
  const shrubMaterial=new THREE.MeshLambertMaterial({color:'#ffffff',flatShading:true});
  // A common trunk and three silhouette families keep the garden looking grown,
  // without dozens of distinct mesh materials or individual draw calls.
  place(plan.trees,new THREE.CylinderGeometry(.13,.25,1,6),trunkMaterial,(o,p)=>{
    const h=3.2+p.scale*2.2;
    o.position.set(p.x,p.y+h*.5,p.z);o.scale.set(.75+p.scale*.22,h,.75+p.scale*.22);
    o.rotation.y=p.variant*Math.PI*2;
  });
  const broad=plan.trees.filter(p=>p.species!==1);
  const narrow=plan.trees.filter(p=>p.species===1);
  const canopyTint=p=>greens[p.species].clone().lerp(greens[(p.species+1)%3],p.variant*.45);
  place(broad,new THREE.IcosahedronGeometry(1,1),foliageMaterial,(o,p)=>{
    const h=3.2+p.scale*2.2;
    o.position.set(p.x+.23*p.scale,p.y+h+.40*p.scale,p.z-.15*p.scale);
    o.scale.set(1.14*p.scale,1.12*p.scale,1.02*p.scale);
    o.rotation.set(.12,p.variant*6,.08);
  },canopyTint);
  place(broad,new THREE.IcosahedronGeometry(1,0),foliageMaterial,(o,p)=>{
    const h=3.2+p.scale*2.2;
    o.position.set(p.x-.63*p.scale,p.y+h+.02*p.scale,p.z+.4*p.scale);
    o.scale.set(.78*p.scale,.70*p.scale,.74*p.scale);
    o.rotation.y=p.variant*4;
  },p=>greens[(p.species+1)%3]);
  place(narrow,new THREE.ConeGeometry(1,2.85,7),foliageMaterial,(o,p)=>{
    const h=3.2+p.scale*2.2;
    o.position.set(p.x,p.y+h+.12*p.scale,p.z);
    o.scale.set(.94*p.scale,1.18*p.scale,.94*p.scale);
    o.rotation.y=p.variant*6;
  },p=>greens[0]);
  place(plan.shrubs,new THREE.IcosahedronGeometry(1,0),shrubMaterial,(o,p)=>{
    o.position.set(p.x,p.y+.44*p.scale,p.z);
    o.scale.set(.63*p.scale,.52*p.scale,.57*p.scale);
    o.rotation.y=p.variant*6;
  },p=>greens[(p.species+1)%3].clone().lerp(terrainColors[1],.17));
  place(plan.rocks,new THREE.DodecahedronGeometry(1,0),stoneMaterial,(o,p)=>{
    o.position.set(p.x,p.y+.16*p.scale,p.z);
    o.scale.set(.65*p.scale,.28*p.scale,.48*p.scale);
    o.rotation.set(p.variant*.15,p.variant*6,p.variant*.16);
  },p=>stones[p.species%stones.length]);
  // Architecture has metre-scaled UVs, so windows and joints do not stretch
  // as buildings grow. Seeded materials vary without loading external assets.
  if(plan.buildings?.length){
    const masonry=[
      new THREE.MeshStandardMaterial({map:surfaceTexture(THREE,'brick'),roughness:.91,color:'#e6e0d8'}),
      new THREE.MeshStandardMaterial({map:surfaceTexture(THREE,'concrete'),roughness:.94,color:'#e2e3df'}),
      new THREE.MeshStandardMaterial({map:surfaceTexture(THREE,'windows'),roughness:.6,metalness:.12,color:'#d9e0df'})
    ];
    const roofMat=new THREE.MeshStandardMaterial({map:surfaceTexture(THREE,'roof'),roughness:.83,color:'#c4c9c8'});
    const buildingGroup=new THREE.Group();
    for(const p of plan.buildings){
      const material=masonry[Math.min(2,Math.floor(p.variant*3))];
      const body=new THREE.Mesh(uvBox(THREE,p.width,p.height,p.depth,3),material);
      body.position.set(p.x,p.y+p.height/2,p.z);buildingGroup.add(body);
      const cap=new THREE.Mesh(uvBox(THREE,p.width+.3,.42,p.depth+.3,2.8),roofMat);
      cap.position.set(p.x,p.y+p.height+.18,p.z);buildingGroup.add(cap);
      // Parapet corners are restrained; the facade textures supply most detail.
      if(p.roof){
        const ledge=new THREE.Mesh(uvBox(THREE,p.width+.5,.15,p.depth+.5,2.8),roofMat);
        ledge.position.set(p.x,p.y+p.height+.44,p.z);buildingGroup.add(ledge);
      }
    }
    scene.add(buildingGroup);
  }
  return plan;
}
