// Simplified metal roof surface reconstructed from Abandoned Scans' uploaded
// Sketchfab GLB, with roof height samples derived directly from its mesh.
// Mesh has been reduced to 35 × 25 samples, flattened to sit on the external
// reception roof, and given a neutral dark metal finish (original large
// urban-scene photographic texture intentionally omitted).
// Original: https://sketchfab.com/3d-models/just-a-metal-roof-for-your-project-20fc70469ccd441bb4c9732b3b6886eb
// Author: Abandoned Scans; licence: CC BY 4.0.
const ROOF_HEIGHT_SAMPLE='T09PT09OTk5OTk1NTU5OTExMT09RUUpKSk9TU1NLcnJySUmlT09PT09OTk5OTk1NTk5OTExPT09RUU9PVV5ibXJycklJSaWlT09PT05OTk5OTU1NTk5MTExPT1FVVV9obXBycnJJSUlJpaVPT09PT05OTk5OTU1OTk5MTE9UVV1ocHl5dHJnUklJSUmlpaVPT09PTk5OTk5NTU1OTk5UVF9ncHmBi4t/dGNSTExMSKWlpaVPT09PTk5OTk5NTU5VVV1nb3iJ4Z6el41+bF1STEhIpaWlpaVPT09OTk5OTk5VVV5ncHiB4eXmvr6hl4h2Z1ZMSEilpaWlpaVPT09OTk5WVl9ncHiCi6jy8ua+vrChkYBxYlFLS6WlpaWlpahPT09WVmBmopSKivO9vr6+vr2zqZ6RgHZsXFFLpaWlpaWlqKijo3ppeqSioqLy8/K+vr28samekod7b2RbS0mnpaWlpaWoqamuo7fW1qmkssDyv768sKaelYmAdm9kW1FJSaenpaWlqamssLe4v9jYv7LAwMC+saielIuBeG9nXFNMSklJp6enqqurrrC1uLy/xMPCv8C+s6qfloyBeW9nX1RNTEpKSUmuqqqtsLKytba9v8LEw8K/tqyhmIyEenFoX1dNTUxMSkpKtra3t7q+wcLExMPDw66lmZGGhnpoYVdRTk1NTU1NTExKSkq6vMHAwMTIyMfEu7GnppmGfnNrYlhRUU5OTU1NTU1MTEpKsrLGyMnHwLWro6Ghpn9uY1tRUVFRUVFRTk5NTU1NTUxMTEqyssjIwLesoJmNgXhvZFtTUVFRUVFRUVFOTk5NTU1NTUxMTLKytbWsopeOhHxwZlxVU1FRUVFRUVFRUVFOTk1NTU1NTExMspmZmZmNhHtxZ15VVVNTUVFRUVFRUVFRUU5OTk1NTU1NTEyZmZmZgYFyaF5VS0lTU1NTUVFRUVFRUVFRUU5OTU1NTU1MTJmZmYF7ZV9WVUtJSUlTU1NRUVFRUVFRUVFRTk5OTU1NTU1MmZmBgUxMVkxLS0lJSUlTU1NRUVFRUVFRUVFRTk5NTU1NTUw=';
const NX=35,NZ=25;
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
