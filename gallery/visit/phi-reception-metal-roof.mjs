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
 for(let row=0;row<NZ;row++)for(let col=0;col<NX;col++){
  const u=col/(NX-1),v=row/(NZ-1);
  // A shallow relief cap, kept below the next gallery level.
  const h=.06+Math.pow(raw[row*NX+col]/255,1.3)*.42;
  positions.push((u-.5)*(width+.35),h,(v-.5)*(depth+.35));
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
 const metal=new THREE.MeshStandardMaterial({color:'#565c5f',metalness:.44,roughness:.73,
   side:THREE.DoubleSide});
 const group=new THREE.Group();group.name='phi-exterior-reception-metal-roof';
 group.position.set((minX+maxX)/2,elevation+ceilingHeight+.12,(minZ+maxZ)/2);
 const surface=new THREE.Mesh(geo,metal);
 surface.name='abandoned-scans-reduced-roof-relief';
 surface.receiveShadow=true;group.add(surface);
 // Continuous edge flashing hides any small gap to the existing reception cap.
 const flashing=new THREE.MeshStandardMaterial({color:'#31383a',metalness:.45,roughness:.72});
 for(const x of [-1,1]){
  const edge=new THREE.Mesh(new THREE.BoxGeometry(.1,.12,depth+.5),flashing);
  edge.position.set(x*(width+.3)/2,.02,0);group.add(edge);
 }
 for(const z of [-1,1]){
  const edge=new THREE.Mesh(new THREE.BoxGeometry(width+.5,.12,.1),flashing);
  edge.position.set(0,.02,z*(depth+.3)/2);group.add(edge);
 }
 scene.add(group);
 group.userData.modelLoaded=true;
 group.userData.attribution='Abandoned Scans · Just a metal roof for your project · CC BY 4.0';
 group.userData.sourceMethod='reduced uploaded GLB geometry; neutral metal material';
 return group;
}
