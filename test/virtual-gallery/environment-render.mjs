// Procedural exterior for the daily museum. Small draw-call budget: one
// terrain mesh, one gradient sky and one softly drawn distant-city strip.
import {buildEnvironmentPlan} from './environment-v1.mjs';
import {PHI_EXTERIOR_PLANTING_ENABLED} from './phi-outdoor-plants.mjs?v=plant-rows-20261027';
import {addProceduralBackdrop} from './procedural-backdrop.mjs?v=daytime-restored-20261027';
import {placeCastIronStreetLamp} from './cast-iron-street-lamps.mjs?v=deferred-download-20261022';

const PALETTES={
  meadow:{horizon:'#cbd5cc',zenith:'#b1c8cf',terrain:['#7c9077','#9eab86','#71856e'],trees:['#536d54','#667b58','#79906b'],stone:['#b2b3a6','#9b9f91']},
  heath:{horizon:'#d4cdbf',zenith:'#b1c6cc',terrain:['#918d73','#b0a785','#7d896f'],trees:['#61705b','#758168','#8e997b'],stone:['#b6aea0','#999b8e']},
  grove:{horizon:'#cbd5cc',zenith:'#abc7cc',terrain:['#768978','#99a58a','#6e8277'],trees:['#496856','#5f7c62','#849b7c'],stone:['#b5b4ac','#949e97']},
  urban:{horizon:'#e1edf2',zenith:'#91c4e8',terrain:['#90928b','#a9aaa0','#80837d'],trees:['#5b735f','#72826c','#889383'],stone:['#b1b1a9','#90948e']}
};

// Offline-safe procedural exterior textures; seeded architecture retains stable
// materials even when third-party texture CDNs are unavailable.
function surfaceTexture(THREE,kind){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d'),hash=(x,y)=>(Math.imul(x+31,73856093)^Math.imul(y+17,19349663))>>>0;
  const base=kind==='brick'?'#b8a99a':kind==='concrete'?'#b6b8b1':kind==='windows'?'#bfc4c0':kind==='roof'?'#757c7a':'#93968b';
  ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
  if(kind==='paving'||kind==='stone'){
    ctx.fillStyle=kind==='paving'?'#c9c6be':'#b2aea5';ctx.fillRect(0,0,256,256);
    ctx.strokeStyle='rgba(71,68,63,.19)';ctx.lineWidth=2;
    if(kind==='paving'){
      for(let y=0;y<=256;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
      for(let row=0;row<4;row++)for(let x=(row%2)*64;x<=256;x+=128){
        ctx.beginPath();ctx.moveTo(x,row*64);ctx.lineTo(x,(row+1)*64);ctx.stroke();
      }
    }else{
      for(let y=0;y<=256;y+=85){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
    }
  }else if(kind==='brick'){
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
export function createExteriorLandscape(THREE,scene,layout,studies,{lowPower=false,protectedLayouts=[],approach=null,plaza=null}={}){
  const plan=buildEnvironmentPlan(layout,studies,{lowPower,protectedLayouts,approach,plaza});
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
  const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({
    vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false
  }));
  sky.position.set(plan.centerX,layout.rooms[0].y,plan.centerZ);
  sky.renderOrder=-5;
  scene.add(sky);
  scene.background=color(palette.horizon);
  // Distance haze belongs to the cards, keeping the actual gallery clear.
  // The photograph also disabled scene fog once it had finished loading.
  scene.fog=null;
  plan.backdrop=addProceduralBackdrop(THREE,scene,{centerX:plan.centerX,centerZ:plan.centerZ,
    groundY:plaza?.level||0,lowPower});

  // Terrain gently rises only outside the actual footprint and approach bridges.
  // Heights are sampled from the SAME function as all the planted instances.
  const segments=lowPower?48:76;
  const groundGeo=new THREE.PlaneGeometry(plan.size,plan.size,segments,segments);
  groundGeo.rotateX(-Math.PI/2);
  const position=groundGeo.getAttribute('position');
  // The world has a finite terrain mesh while the sky and distant cards extend
  // indefinitely. Fade the ground's outer ~30% into the actual background
  // instead of exposing a hard, square edge at the horizon. Three.js uses
  // four-component vertex colours as RGB + alpha on transparent materials.
  // This adds no geometry, textures or post-processing passes.
  const groundColors=new Float32Array(position.count*4);
  const grass=new THREE.Color();
  const smoothstep=t=>{const k=Math.max(0,Math.min(1,t));return k*k*(3-2*k);};
  const half=plan.size/2;
  for(let i=0;i<position.count;i++){
    const localX=position.getX(i),localZ=position.getZ(i);
    const x=localX+plan.centerX,z=localZ+plan.centerZ;
    position.setY(i,plan.heightAt(x,z));
    const variation=Math.sin(x*.16+plan.phase)*Math.cos(z*.13+plan.slope);
    const detail=noise(x,z,plan.phase);
    const t=Math.max(0,Math.min(1,.5+variation*.29+detail*.10));
    grass.copy(terrainColors[0]).lerp(terrainColors[1],t);
    if(variation<-.48)grass.lerp(terrainColors[2],(-variation-.48)*.44);
    const fade=Math.max(Math.abs(localX),Math.abs(localZ))/half;
    const alpha=1-smoothstep((fade-.68)/.32);
    groundColors[i*4]=grass.r;
    groundColors[i*4+1]=grass.g;
    groundColors[i*4+2]=grass.b;
    groundColors[i*4+3]=alpha;
  }
  position.needsUpdate=true;
  groundGeo.setAttribute('color',new THREE.BufferAttribute(groundColors,4));
  groundGeo.computeVertexNormals();
  const groundMap=surfaceTexture(THREE,'ground');
  groundMap.repeat.set(plan.size/12,plan.size/12);
  const ground=new THREE.Mesh(groundGeo,new THREE.MeshLambertMaterial({
    vertexColors:true,transparent:true,map:groundMap,side:THREE.DoubleSide
  }));
  ground.position.set(plan.centerX,0,plan.centerZ);
  scene.add(ground);

  // Ground-floor civic forecourt: wide unobstructed centre and furnished edges.
  if(plan.plaza){
    const p=plan.plaza;
    const square=new THREE.Group();
    const pavingMap=surfaceTexture(THREE,'paving');
    pavingMap.repeat.set(p.halfDepth*2/6,p.halfWidth*2/6);
    const paving=new THREE.MeshStandardMaterial({map:pavingMap,color:'#eee9e1',roughness:.94});
    // Staging square: reuse the previously uploaded CC0 OpenGameArt floor scan
    // instead of the hand-drawn canvas paving. Keep the existing map as a
    // synchronous fallback when a texture request fails or is still loading.
    if(globalThis.__phiReceptionTestRefresh){
      new THREE.TextureLoader().load('./textures/open-game-art/028.jpg',texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.repeat.set(p.halfWidth*2/4,p.halfDepth*2/4);
        texture.anisotropy=lowPower?1:4;
        paving.map=texture;
        paving.color.set('#ffffff');
        paving.needsUpdate=true;
      },undefined,error=>console.warn('Uploaded plaza paving unavailable; retaining original',error));
    }
    const stoneMap=surfaceTexture(THREE,'stone');
    const stoneEdge=new THREE.MeshStandardMaterial({map:stoneMap,color:'#e4dfd5',roughness:.94});
    const bronze=new THREE.MeshStandardMaterial({color:'#424a49',metalness:.42,roughness:.52});
    const planted=new THREE.MeshStandardMaterial({color:'#58705c',roughness:1,flatShading:true});
    const lampGlass=new THREE.MeshStandardMaterial({color:'#f5e8cc',emissive:'#e9c99b',emissiveIntensity:.52,roughness:.36});
    const at=(along,across,y=0)=>new THREE.Vector3(
      p.centre.x+p.outward.x*along+p.transverse.x*across,
      p.level+y,
      p.centre.z+p.outward.z*along+p.transverse.z*across);
    const box=(w,h,d,along,across,y,material)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.rotation.y=Math.atan2(p.outward.x,p.outward.z);
      mesh.position.copy(at(along,across,y));square.add(mesh);
      return mesh;
    };
    // The box is rotated to face the entrance: local X is ACROSS the plaza
    // and local Z is ALONG the approach. Keep the two dimensions in that order.
    // Swapping them made all paving joints and perimeter edges overlap along
    // the centreline, producing the long raised stripe in front of the door.
    box(p.halfWidth*2,.16,p.halfDepth*2,0,0,-.17,paving);
    // A regular, level paving grid with joints following the correct axes.
    for(let along=-p.halfDepth+4;along<p.halfDepth;along+=4){
      box(p.halfWidth*2,.009,.022,along,0,-.083,stoneEdge);
    }
    for(let across=-p.halfWidth+4;across<p.halfWidth;across+=4){
      box(.022,.009,p.halfDepth*2,0,across,-.083,stoneEdge);
    }
    for(const side of [-1,1]){
      // Furnish only the perimeter: clear sightline to the gallery entrance.
      for(const along of [-9,6,13]){
        const across=side*(p.halfWidth-2.2);
        box(1.2,.57,2.7,along,across,.20,stoneEdge);
        box(.92,.13,2.35,along,across,.55,paving);
      }
      if(PHI_EXTERIOR_PLANTING_ENABLED){
      for(const along of [-13,12]){
        const across=side*(p.halfWidth-4.6);
        box(1.75,.69,1.75,along,across,.22,stoneEdge);
        // Layered, subtly offset planting instead of identical geometric balls.
        for(let i=0;i<3;i++){
          const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.5+i*.08,1),planted);
          shrub.position.copy(at(along+(i-1)*.46,across+(i%2?-.22:.15),.96+(i%2)*.16));
          shrub.scale.set(1.2,.75,1);
          square.add(shrub);
        }
      }
      }
      for(const along of [-15,0,15]){
        const across=side*(p.halfWidth-1.5);
        const backup=new THREE.Group();
        backup.add(box(.14,3.8,.14,along,across,1.83,bronze));
        backup.add(box(.42,.38,.42,along,across,3.91,lampGlass));
        square.add(backup);
        // Preserve the original plaza layout, approach clearance, paving
        // and seat positions; replace only the six lamppost visuals.
        placeCastIronStreetLamp(THREE,square,at(along,across,0),backup,
          {scale:.98,rotation:Math.atan2(p.outward.x,p.outward.z)});
      }
      box(p.halfWidth*2,.22,.34,side*(p.halfDepth-.42),0,-.09,stoneEdge);
    }
    scene.add(square);
  }

  // Museum forecourt: deliberately omit the procedurally generated city,
  // trees, rocks and shrubs. The sky, terrain and civic plaza stay in place.
  // No distant blocks compete with the tower or consume mobile draw calls.
  return plan;
}

