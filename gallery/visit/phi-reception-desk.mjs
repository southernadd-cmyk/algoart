import {loadPhiDecorAsset,fitPhiDecorAsset} from './phi-model-assets.mjs';
export function fitPhiDesktopModel(THREE,model,width){
 const group=new THREE.Group();group.add(model);group.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 model.position.add(new THREE.Vector3(-centre.x,-box.min.y,-centre.z));group.scale.setScalar(width/Math.max(size.x,size.z,.001));return group;
}
export const DESK_PAPERS=Object.freeze([
 {name:'SM_A4_paper_pile',x:-.82,z:-.13,y:1.126,width:.31,yaw:.16},
 {name:'SM_A4_paper_fold_1',x:-.35,z:.16,y:1.126,width:.27,yaw:-.25},
 {name:'SM_A4_paper_crumbled',x:-1.5,z:.85,y:.48,width:.13,yaw:.4}
]);
export function addPhiReceptionDesk(THREE,scene,reception,elevation,{concrete}={}){
 if(!reception.desk)return null;
 const {desk,cabinet}=reception,root=new THREE.Group();root.name='phi-upgraded-reception-desk';root.position.set(desk.x,elevation,desk.z);scene.add(root);root.userData.propsLoaded=0;
 const walnut=new THREE.MeshStandardMaterial({color:'#795d46',roughness:.75});
 const ink=new THREE.MeshStandardMaterial({color:'#34413d',roughness:.7});
 const brass=new THREE.MeshStandardMaterial({color:'#a18d66',metalness:.62,roughness:.4});
 const paper=new THREE.MeshStandardMaterial({color:'#eee6d6',roughness:.9});
 const part=(w,h,d,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 part(3.35,.09,1.18,0,.075,0,ink);
 for(const side of [-1,1])part(.26,.92,1.38,side*1.72,.54,0,concrete);
 part(3.24,.79,.14,0,.515,-.59,walnut);
 const slats=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.78,.055),walnut,25),matrix=new THREE.Matrix4();slats.name='walnut-front-fluting';
 for(let i=0;i<25;i++){matrix.makeTranslation(-1.5+i*.125,.52,-.684);slats.setMatrixAt(i,matrix);}root.add(slats);
 const shape=new THREE.Shape(),w=3.9,d=1.5,r=.14,x=-w/2,z=-d/2;
 shape.moveTo(x+r,z);shape.lineTo(x+w-r,z);shape.quadraticCurveTo(x+w,z,x+w,z+r);shape.lineTo(x+w,z+d-r);shape.quadraticCurveTo(x+w,z+d,x+w-r,z+d);shape.lineTo(x+r,z+d);shape.quadraticCurveTo(x,z+d,x,z+d-r);shape.lineTo(x,z+r);shape.quadraticCurveTo(x,z,x+r,z);
 const top=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.105,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:2,steps:1,curveSegments:6}),concrete);top.rotation.x=-Math.PI/2;top.position.y=1.01;top.name='rounded-stone-counter';root.add(top);
 part(3.34,.025,.025,0,.93,-.691,brass);
 // A real working surface: laptop, catalogues, pen cup and a warm task lamp.
 part(.54,.028,.36,.34,1.145,.15,ink);
 const screen=part(.52,.36,.032,.34,1.34,.30,ink);screen.rotation.x=-.17;
 const display=new THREE.Mesh(new THREE.PlaneGeometry(.47,.30),new THREE.MeshBasicMaterial({color:'#d9e0ce'}));display.position.set(.34,1.34,.322);display.rotation.x=-.17;root.add(display);
 for(let i=0;i<3;i++){const book=part(.39,.035,.27,-1.28,1.145+i*.038,-.10,i===1?ink:paper);book.rotation.y=.12-i*.07;}
 const cup=new THREE.Mesh(new THREE.CylinderGeometry(.055,.048,.14,16),brass);cup.position.set(.91,1.20,.20);root.add(cup);
 for(let i=0;i<3;i++){const pen=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.22,6),ink);pen.position.set(.89+i*.019,1.34,.20);pen.rotation.z=(i-1)*.13;root.add(pen);}
 const lampBase=new THREE.Mesh(new THREE.CylinderGeometry(.14,.15,.025,24),brass);lampBase.position.set(1.30,1.14,.13);root.add(lampBase);
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.48,12),brass);stem.position.set(1.30,1.38,.13);root.add(stem);
 const shade=new THREE.Mesh(new THREE.ConeGeometry(.24,.19,28,1,true),ink);shade.position.set(1.30,1.63,.13);root.add(shade);
 const glow=new THREE.Mesh(new THREE.CircleGeometry(.21,28),new THREE.MeshBasicMaterial({color:'#f0d69a',side:THREE.DoubleSide}));glow.rotation.x=Math.PI/2;glow.position.set(1.30,1.54,.13);root.add(glow);
 const bin=new THREE.Mesh(new THREE.CylinderGeometry(.16,.13,.45,18,1,true),ink);bin.position.set(-1.5,.25,.85);root.add(bin);
 const label=document.createElement('canvas');label.width=512;label.height=96;const g=label.getContext('2d');g.fillStyle='#34413d';g.fillRect(0,0,512,96);g.fillStyle='#eae2cd';g.font='62px "AlgoArt Marker", Georgia';g.textAlign='center';g.fillText('Reception',256,69,474);
 const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.20,.225),new THREE.MeshBasicMaterial({map:texture}));sign.rotation.y=Math.PI;sign.position.set(0,.60,-.72);root.add(sign);
 const cabinetRoot=new THREE.Group();cabinetRoot.name='phi-art-magazine-cabinet';cabinetRoot.position.set(cabinet.x-desk.x,0,cabinet.z-desk.z);cabinetRoot.rotation.y=cabinet.yaw;root.add(cabinetRoot);
 const cabinetJob=loadPhiDecorAsset(new URL('../../test/virtual-gallery/models/magazine-cabinet.glb',import.meta.url).href).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  cabinetRoot.add(fitPhiDecorAsset(THREE,source.clone(true),cabinet.height));root.userData.propsLoaded++;
 }).catch(error=>console.warn('Reception magazine cabinet unavailable',error));
 const paperJob=loadPhiDecorAsset(new URL('../../test/virtual-gallery/models/paper-clutter.glb',import.meta.url).href).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;source.updateMatrixWorld(true);
  for(const p of DESK_PAPERS){const original=source.getObjectByName(p.name);if(!original)throw new Error('Missing paper object '+p.name);
   const model=original.clone(true);original.matrixWorld.decompose(model.position,model.quaternion,model.scale);model.updateMatrix();
   const fitted=fitPhiDesktopModel(THREE,model,p.width);fitted.position.set(p.x,p.y,p.z);fitted.rotation.y=p.yaw;fitted.name='phi-desk-'+p.name;root.add(fitted);
  }root.userData.propsLoaded++;
 }).catch(error=>console.warn('Reception papers unavailable',error));
 return {root,obstacles:[cabinet],ready:Promise.all([cabinetJob,paperJob])};
}
