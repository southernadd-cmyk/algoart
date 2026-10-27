import {loadPhiDecorAsset} from './phi-model-assets.mjs';

// A continuous grid across the reception, independent of its subdivision cells.
// The uploaded tile is a unit square, with spring at 0 and crown at 1.
export function planPhiReceptionVault(pieces,{floorSpacing=6.2,baySize=4}={}){
 const west=Math.min(...pieces.map(p=>p.x)),east=Math.max(...pieces.map(p=>p.x+p.w));
 const south=Math.min(...pieces.map(p=>p.z)),north=Math.max(...pieces.map(p=>p.z+p.h));
 const columns=Math.ceil((east-west)/baySize),rows=Math.ceil((north-south)/baySize);
 const width=(east-west)/columns,depth=(north-south)/rows;
 const wallHeight=floorSpacing-.34,crown=wallHeight-.06,spring=4.70;
 const tiles=[];
 for(let z=0;z<rows;z++)for(let x=0;x<columns;x++)tiles.push({
  x:west+(x+.5)*width,z:south+(z+.5)*depth,width,depth,
  regions:pieces.map(p=>({west:Math.max(p.x,west+x*width),east:Math.min(p.x+p.w,west+(x+1)*width),
   south:Math.max(p.z,south+z*depth),north:Math.min(p.z+p.h,south+(z+1)*depth)}))
   .filter(r=>r.east-r.west>1e-6&&r.north-r.south>1e-6)
 });
 return {west,east,south,north,columns,rows,tiles,wallHeight,crown,spring,rise:crown-spring};
}

export function addPhiTestVault(THREE,scene,{plan,elevation=0,loadAsset=loadPhiDecorAsset}){
 // Attach synchronously so the floor transform and disposal own the ceiling,
 // even if the model finishes loading after construction or a lift journey.
 const root=new THREE.Group();root.name='phi-test-reception-vault';
 root.position.y=elevation;root.userData.vaultPlan=plan;scene.add(root);
 const diagnostics={tiles:plan.tiles.length,loaded:false,spring:plan.spring,crown:plan.crown,
  coverage:{west:plan.west,east:plan.east,south:plan.south,north:plan.north}};
 root.userData.ready=loadAsset(new URL('./models/gothic-reception-vault.glb',import.meta.url).href).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  source.updateMatrixWorld(true);let tile;source.traverse(o=>{if(o.isMesh&&!tile)tile=o;});
  if(!tile)throw new Error('Uploaded Gothic vault has no mesh');
  const tileGeometry=tile.geometry.clone().applyMatrix4(tile.matrixWorld);
  const geometry=buildPhiReceptionVaultGeometry(THREE,tileGeometry,plan);tileGeometry.dispose();
  const ceiling=new THREE.Mesh(geometry,tile.material);ceiling.name='uploaded-gothic-ceiling-tiles';root.add(ceiling);
  root.userData.modelLoaded=true;diagnostics.loaded=true;
 }).catch(error=>{diagnostics.error=error.message;console.warn('Test reception ceiling unavailable',error);});
 if(globalThis.location?.pathname.includes('/test/virtual-gallery/'))globalThis.__phiReceptionVault=diagnostics;
 return root;
}

// Clip the repeated source triangles to the physical footprint. The reception
// has a courtyard notch: a bounding-box roof would seal its glass walkway.
export function buildPhiReceptionVaultGeometry(THREE,source,plan){
 const positions=[],normals=[],uvs=[],index=source.index;
 const pos=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv');
 const clip=(polygon,axis,limit,sign)=>{
  const result=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;
   if(da>=-1e-8)result.push(a);
   if((da<0&&db>0)||(da>0&&db<0)){
    const t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));
   }
  }
  return result;
 };
 for(const bay of plan.tiles)for(let i=0;i<(index?.count||pos.count);i+=3){
  const triangle=Array.from({length:3},(_,j)=>{
   const k=index?index.getX(i+j):i+j;
   return [bay.x+pos.getX(k)*bay.width,plan.spring+pos.getY(k)*plan.rise,bay.z+pos.getZ(k)*bay.depth,
    normal?normal.getX(k)/bay.width:0,normal?normal.getY(k)/plan.rise:-1,normal?normal.getZ(k)/bay.depth:0,
    uv?.getX(k)||0,uv?.getY(k)||0];
  });
  for(const region of bay.regions){
   let polygon=triangle;
   for(const [axis,limit,sign] of [[0,region.west,1],[0,region.east,-1],[2,region.south,1],[2,region.north,-1]]){
    polygon=clip(polygon,axis,limit,sign);if(!polygon.length)break;
   }
   for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
    positions.push(...v.slice(0,3));const length=Math.hypot(...v.slice(3,6))||1;
    normals.push(...v.slice(3,6).map(n=>n/length));uvs.push(v[6],v[7]);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}
