import {tiledBoxUvs} from './architectural-materials.mjs?v=ambientcg-ceiling-20261022';
import {loadPhiDecorAsset} from './phi-model-assets.mjs';
// Chinese roof. Low poly model. — KSmodels, CC BY 4.0.
// Two original curved tile sections share geometry and all three material maps.
const roofURL=new URL('./models/reception-chinese-roof.glb',import.meta.url).href;
const SOURCE={minX:-1.701631546,maxX:.128033981,minY:-.719325066,maxY:.320334882};
// Lower edge of the model's tile/rafter section, from eave to ridge.
const UNDERSIDE=[[-1.701631546,-.719325066],[-1.3603,-.5255],[-1.0609,-.3998],[-.2484,.1002],[.128033981,.1564]];
export function addPhiReceptionMetalRoof(THREE,scene,{bounds,elevation,ceilingHeight=5.2,brick}){
 if(!bounds)return null;
 const {minX,maxX,minZ,maxZ}=bounds,width=maxX-minX,depth=maxZ-minZ;
 if(!(width>3&&depth>3))return null;
 const roofW=width+1.9,roofD=depth+2.25,rise=2.8,eave=.72;
 const group=new THREE.Group();group.name='phi-exterior-reception-chinese-roof';
 group.position.set((minX+maxX)/2,elevation+ceilingHeight,(minZ+maxZ)/2-.425);
 group.userData.attribution='Chinese roof. Low poly model. · KSmodels · CC BY 4.0';scene.add(group);
 const sx=(roofW/2)/(SOURCE.maxX-SOURCE.minX),sy=rise/(SOURCE.maxY-SOURCE.minY);
 const profile=UNDERSIDE.map(([x,y])=>[-roofW/2+(x-SOURCE.minX)*sx,eave+(y-SOURCE.minY)*sy+.015]);
 const heightAt=x=>{for(let i=1;i<profile.length;i++){const a=profile[i-1],b=profile[i];if(x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return profile.at(-1)[1];};
 const wallEave=heightAt(-width/2),left=[[-width/2,wallEave],...profile.filter(([x])=>x>-width/2)];
 const top=[...left,...left.slice(0,-1).reverse().map(([x,y])=>[-x,y])];
 const masonry=brick||new THREE.MeshStandardMaterial({color:'#383938',roughness:.94});
 const gable=new THREE.Shape();gable.moveTo(-width/2,0);gable.lineTo(width/2,0);
 for(const [x,y] of [...top].reverse())gable.lineTo(x,y);gable.closePath();
 const wallDepth=.265,geo=new THREE.ExtrudeGeometry(gable,{depth:wallDepth,bevelEnabled:false});
 const pos=geo.attributes.position,uv=geo.attributes.uv,tile=masonry.userData.tileMeters||1.05;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+group.position.x)/tile,(pos.getY(i)+group.position.y)/tile);
 for(const side of [-1,1]){
  const face=new THREE.Mesh(geo,masonry);face.position.z=side*depth/2+.425-wallDepth/2;
  face.name='chinese-roof-brick-gable';face.receiveShadow=true;group.add(face);
  const bandGeo=tiledBoxUvs(new THREE.BoxGeometry(wallDepth,wallEave,depth),wallDepth,wallEave,depth,tile);
  const band=new THREE.Mesh(bandGeo,masonry);band.position.set(side*width/2,wallEave/2,.425);
  band.name='chinese-roof-brick-eaves';band.receiveShadow=true;group.add(band);
 }
 const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,roofD,12),new THREE.MeshStandardMaterial({color:'#426b31',roughness:.8}));
 ridge.rotation.x=Math.PI/2;ridge.position.y=eave+rise-.13;ridge.name='chinese-roof-ridge-cap';group.add(ridge);
 loadPhiDecorAsset(roofURL).then(source=>{
  if(!group.parent||group.userData.galleryDisposed)return;
  const box=new THREE.Box3().setFromObject(source),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
  for(const side of [-1,1]){
   const slope=new THREE.Group(),fit=new THREE.Group(),model=source.clone(true);
   model.position.add(new THREE.Vector3(-box.max.x,-box.min.y,-centre.z));fit.add(model);
   fit.scale.set((roofW/2+.025)/size.x,rise/size.y,roofD/size.z);slope.add(fit);
   slope.rotation.y=side===-1?0:Math.PI;slope.position.y=eave;
   slope.name='ksmodels-curved-tile-roof';slope.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});group.add(slope);
  }
  group.userData.modelLoaded=true;
 }).catch(error=>{group.userData.loadError=String(error);console.warn('Reception roof unavailable',error);});
 return group;
}
