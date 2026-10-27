// Simplified metal roof surface reconstructed from Abandoned Scans' uploaded
// Sketchfab GLB, with roof height samples derived directly from its mesh.
// Mesh has been reduced to 18 × 13 samples, flattened to sit on the external
// reception roof, and given a neutral dark metal finish (original large
// urban-scene photographic texture intentionally omitted).
// Original: https://sketchfab.com/3d-models/just-a-metal-roof-for-your-project-20fc70469ccd441bb4c9732b3b6886eb
// Author: Abandoned Scans; licence: CC BY 4.0.
const ROOF_HEIGHT_SAMPLE='aFBPTk5OTU5MTk9PT1hgamFLllxPTk5OTU5NTlJZZHBwZU5Jo4VWT05OTU5QV2WAko17Xk1JpaSEVk5OUVhjdpjWxqmNblRKpaWkh2lhaoyTyMDHvKmRd19OpqWmqKqmvrK22L6vnox5ZlRKqKirr7W9x8G8s6CNemlZT0pJs7G2ur7CwbWklIBrW1FNTEtKur7BxcO5rpiAb15UT01NTExKt8TFva2flXVgVVFRT01NTUxLsbatm4h1ZFdSUVFRUE5NTUxMn5mJdmRVUlNRUVFRUU9NTU1MmIhnWVBJS1JRUVFRUU9OTU1N';
const NX=18,NZ=13;
export function addPhiReceptionMetalRoof(THREE,scene,{bounds,elevation,ceilingHeight=5.2}){
 if(!bounds)return null;
 const {minX,maxX,minZ,maxZ}=bounds;
 const width=maxX-minX,depth=maxZ-minZ;
 if(!(width>3&&depth>3))return null;
 const raw=Uint8Array.from(atob(ROOF_HEIGHT_SAMPLE),c=>c.charCodeAt(0));
 if(raw.length!==NX*NZ)throw Error('Uploaded roof height sample is invalid');
 const positions=[],uv=[],indices=[];
 const eaveOverhang=.95,frontOverhang=1.55;
 const roofW=width+2*eaveOverhang,roofD=depth+frontOverhang+.7;
 for(let row=0;row<NZ;row++)for(let col=0;col<NX;col++){
  const u=col/(NX-1),v=row/(NZ-1);
  // Raise a real, visible ridge over the reception; retain fine variations
  // from the CC BY scan. The eaves extend beyond the black-brick wall.
  const ridge=1-Math.abs(u*2-1);
  const h=.12+ridge*2.35+Math.pow(raw[row*NX+col]/255,1.3)*.065;
  positions.push((u-.5)*roofW,h,(v-.5)*roofD-frontOverhang*.5+.35);
  uv.push(u,v);
 }
 for(let row=0;row<NZ-1;row++)for(let col=0;col<NX-1;col++){
  const a=row*NX+col,b=a+1,c=a+NX,d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 const metal=new THREE.MeshStandardMaterial({color:'#a9adb1',metalness:.32,roughness:.58,
   side:THREE.DoubleSide});
 const group=new THREE.Group();group.name='phi-exterior-reception-metal-roof';
 // Eaves clear the existing facade sign; the ridge is deliberately taller.
 group.position.set((minX+maxX)/2,elevation+ceilingHeight+1.10,(minZ+maxZ)/2);
 const surface=new THREE.Mesh(geo,metal);
 surface.name='abandoned-scans-reduced-roof-relief';
 surface.receiveShadow=true;group.add(surface);
 // Slim standing seams and clear fascia make the shallow metal pitched
 // silhouette readable against the dark brickwork at street level.
 const flashing=new THREE.MeshStandardMaterial({color:'#333c40',metalness:.53,roughness:.59});
 const seamMaterial=new THREE.MeshStandardMaterial({color:'#b0b5b2',metalness:.62,roughness:.53});
 const eaveY=.10,roofRise=2.35;
 for(const side of [-1,1]){
  const eave=new THREE.Mesh(new THREE.BoxGeometry(.13,.16,roofD+.12),flashing);
  eave.position.set(side*roofW/2,eaveY,-frontOverhang*.5+.35);
  group.add(eave);
 }
 for(const side of [-1,1]){
  // Edge trim follows the two pitched slopes via a short faceted line.
  const z=side*roofD/2-frontOverhang*.5+.35;
  for(let i=0;i<2;i++){
   const x=(i===0?-roofW/4:roofW/4);
   const y=(eaveY+roofRise+.12)/2;
   const length=Math.hypot(roofW/2,roofRise);
   const trim=new THREE.Mesh(new THREE.BoxGeometry(length,.09,.12),flashing);
   trim.position.set(x,y,z);
   trim.rotation.z=(i===0?1:-1)*Math.atan2(roofRise,roofW/2);
   group.add(trim);
  }
 }
 for(let j=1;j<9;j++){
  const v=j/9,z=(v-.5)*roofD-frontOverhang*.5+.35;
  for(let i=0;i<2;i++){
   const line=new THREE.Mesh(new THREE.BoxGeometry(roofW/2,.025,.035),seamMaterial);
   line.position.set(i===0?-roofW/4:roofW/4,eaveY+roofRise/2,z);
   line.rotation.z=(i===0?1:-1)*Math.atan2(roofRise,roofW/2);
   group.add(line);
  }
 }
 scene.add(group);
 group.userData.modelLoaded=true;
 group.userData.attribution='Abandoned Scans · Just a metal roof for your project · CC BY 4.0';
 group.userData.sourceMethod='reduced uploaded GLB geometry; neutral metal material';
 return group;
}
