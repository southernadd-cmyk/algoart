// Procedural exterior for the daily museum. Small draw-call budget: one
// terrain mesh, one sky shell and batched instanced plants/stone.
import {buildEnvironmentPlan} from './environment-v1.mjs';

const PALETTES={
  meadow:{horizon:'#cbd5cc',zenith:'#b1c8cf',terrain:['#7c9077','#9eab86','#71856e'],trees:['#536d54','#667b58','#79906b'],stone:['#b2b3a6','#9b9f91']},
  heath:{horizon:'#d4cdbf',zenith:'#b1c6cc',terrain:['#918d73','#b0a785','#7d896f'],trees:['#61705b','#758168','#8e997b'],stone:['#b6aea0','#999b8e']},
  grove:{horizon:'#cbd5cc',zenith:'#abc7cc',terrain:['#768978','#99a58a','#6e8277'],trees:['#496856','#5f7c62','#849b7c'],stone:['#b5b4ac','#949e97']}
};
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
  const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({
    vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false
  }));
  sky.position.set(plan.centerX,0,plan.centerZ);
  sky.renderOrder=-5;
  scene.add(sky);
  scene.background=color(palette.horizon);
  scene.fog=new THREE.Fog(color(palette.horizon),55,164);

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
  const ground=new THREE.Mesh(groundGeo,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
  ground.position.set(plan.centerX,0,plan.centerZ);
  scene.add(ground);

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
  return plan;
}
