import {loadPhiDecorAsset,fitPhiDecorAsset} from './phi-model-assets.mjs';

export function addPhiReceptionGramophone(THREE,scene,{furnishing,elevation,camera,canvas,timber,trims,music,debug=false,loadAsset=loadPhiDecorAsset}){
 const root=new THREE.Group();root.name='phi-reception-gramophone';
 root.position.set(furnishing.desk.x+4.4,elevation,furnishing.desk.z+2.35);scene.add(root);
 const box=(w,h,d,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 box(1.12,.78,.66,0,.44,0,timber);box(1.18,.065,.72,0,.86,0,timber);
 for(const x of [-.44,.44])box(.075,.13,.48,x,.065,0,trims);
 for(const y of [.30,.59])box(.74,.025,.025,0,y,-.344,trims);
 loadAsset(new URL('./models/reception-gramophone.glb',import.meta.url).href).then(source=>{
  if(!root.parent||root.userData.galleryDisposed)return;
  const model=fitPhiDecorAsset(THREE,source.clone(true),.73);model.position.y=.895;root.add(model);root.userData.modelLoaded=true;
 }).catch(error=>console.warn('Reception gramophone unavailable',error));
 const ray=new THREE.Raycaster();
 const click=event=>{
  if(!document.querySelector('#welcome')?.hidden)return;
  const rect=canvas.getBoundingClientRect(),point=document.pointerLockElement===canvas?new THREE.Vector2():new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  ray.setFromCamera(point,camera);const hit=ray.intersectObject(root,true)[0];
  if(hit&&hit.distance<4.5){event.preventDefault();event.stopImmediatePropagation();music.open();}
 };canvas.addEventListener('click',click,true);
 if(debug)globalThis.__phiGramophone={state:music.record.state,root,open:music.open,record:music.record};
 const emitter=new THREE.Object3D();emitter.position.y=1.2;root.add(emitter);
 return {root,emitter,obstacle:{x:root.position.x,z:root.position.z,width:1.25,depth:.85,yaw:0,kind:'gramophone'},
  dispose(){canvas.removeEventListener('click',click,true);if(debug)delete globalThis.__phiGramophone;}
 };
}
