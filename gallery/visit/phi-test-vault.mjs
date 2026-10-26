// Test-only vaulted reception canopy, based on the low-poly Gothic church
// ceiling study by ramonscortanu (CC BY 4.0).
// A lightweight mesh study of the original intersecting pointed vaults.
// The original downloaded model/texture is retained separately for asset import.
export function addPhiTestVault(THREE,scene,{doorway,outward,elevation,stone}){
 const root=new THREE.Group();root.name='phi-test-gothic-reception-vault';
 const inward={x:-outward.x,z:-outward.z};
 const yaw=Math.atan2(outward.x,outward.z);
 root.position.set(doorway.x+inward.x*2.35,elevation+3.3,doorway.z+inward.z*2.35);
 root.rotation.y=yaw;
 // Cross-vault: four lobes meet at a gently pointed central crown.
 // The ribs are hung below the existing slab, with no change to collision.
 const w=3.35,d=4.25,n=24,vertices=[],indices=[];
 function rise(x,z){
  const ax=Math.abs(x/(w/2)),az=Math.abs(z/(d/2));
  const arch=Math.min(1,Math.max(ax,az));
  return -.09-.48*(arch*arch);
 }
 for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
  const x=-w/2+w*ix/n,z=-d/2+d*iz/n;
  vertices.push(x,rise(x,z),z);
 }
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
  const a=iz*(n+1)+ix,b=a+1,c=a+n+1;
  indices.push(a,c,b,b,c,c+1);
 }
 const geom=new THREE.BufferGeometry();
 geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geom.setIndex(indices);geom.computeVertexNormals();
 const vaultMat=new THREE.MeshStandardMaterial({color:'#c7b9a4',roughness:.94,side:THREE.DoubleSide});
 const canopy=new THREE.Mesh(geom,vaultMat);canopy.name='phi-test-gothic-vault-web';root.add(canopy);
 const ribMat=stone?.clone?.()||new THREE.MeshStandardMaterial({color:'#988773',roughness:.95});
 ribMat.side=THREE.DoubleSide;
 function rib(points,radius=.065){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(curve,28,radius,6,false),ribMat));
 }
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const pts=[];
  for(let k=0;k<=14;k++){
   const t=k/14;
   const x=sx*(w/2)*t,z=sz*(d/2)*t;
   pts.push([x,rise(x,z)-.035,z]);
  }
  rib(pts,.08);
 }
 // Strong axial pointed ribs recall the reference's Gothic springing.
 for(const sx of [-1,1])rib(Array.from({length:17},(_,i)=>{
  const t=i/16,z=-d/2+d*t,x=sx*w/2;
  return [x,rise(x,z)-.035,z];
 }),.055);
 const light=new THREE.PointLight(0xffe6bc,.8,5,2);
 light.position.set(0,-.72,0);root.add(light);
 scene.add(root);return root;
}
