// Repeated vaulted roof tiles above the reception ceiling, not a suspended canopy.
// The vault is architectural roof geometry, with no hanging light.
export function addPhiTestVault(THREE,scene,{doorway,outward,elevation,stone}){
 const root=new THREE.Group();root.name='phi-test-vaulted-roof-tiles';
 const inward={x:-outward.x,z:-outward.z};
 root.position.set(doorway.x+inward.x*2.15,elevation+5.08,doorway.z+inward.z*2.15);
 root.rotation.y=Math.atan2(outward.x,outward.z);
 const span=4.3,tilesX=2,tilesZ=2,side=span/2,n=12;
 const web=new THREE.MeshStandardMaterial({color:'#d6c8b5',roughness:.96,side:THREE.DoubleSide});
 const ribs=stone?.clone?.()||new THREE.MeshStandardMaterial({color:'#988773',roughness:.95});
 const positions=[],indices=[];
 for(let tz=0;tz<tilesZ;tz++)for(let tx=0;tx<tilesX;tx++){
  const ox=(tx-(tilesX-1)/2)*side,oz=(tz-(tilesZ-1)/2)*side;
  const base=positions.length/3;
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
   const lx=(x/n-.5)*side,lz=(z/n-.5)*side;
   const edge=Math.max(Math.abs(lx),Math.abs(lz))/(side/2);
   // Crown rises above its perimeter. Nothing protrudes below the slab.
   positions.push(ox+lx,.08+.64*(1-edge*edge),oz+lz);
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const a=base+z*(n+1)+x,b=a+1,c=a+n+1;
   indices.push(a,c,b,b,c,c+1);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const roof=new THREE.Mesh(geometry,web);roof.name='vaulted-roof-tile-array';root.add(roof);
 // Rib seams stay on the roof surface; no suspended spokes or point lights.
 const ribMat=ribs;ribMat.side=THREE.DoubleSide;
 function rib(points){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(curve,14,.045,5,false),ribMat));
 }
 for(let tx=0;tx<tilesX;tx++)for(let tz=0;tz<tilesZ;tz++){
  const cx=(tx-(tilesX-1)/2)*side,cz=(tz-(tilesZ-1)/2)*side;
  for(const sign of [-1,1])rib(Array.from({length:9},(_,i)=>{
   const t=i/8,px=sign*(t-.5)*side,pz=(t-.5)*side;
   const edge=Math.max(Math.abs(px),Math.abs(pz))/(side/2);
   return [cx+px,.115+.64*(1-edge*edge),cz+pz];
  }));
 }
 scene.add(root);return root;
}
