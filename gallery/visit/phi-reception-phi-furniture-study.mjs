// Test-gallery-only architectural reception furniture: no stone, timber, or added lights.
import {addPhiOfficeChair} from './phi-office-reception.mjs?v=gallery-reception-20261027';
export const PHI=(1+Math.sqrt(5))/2;
export function phiFurnitureDimensions(){
 const width=3.9,depth=width/(PHI*PHI),main=width/PHI;
 const benchWidth=1.85,benchDepth=benchWidth/(PHI*PHI);
 return {desk:{width,depth,main,minor:width-main,splitX:-width/2+main},
  bench:{width:benchWidth,depth:benchDepth,main:benchWidth/PHI,minor:benchWidth-benchWidth/PHI}};
}
function finishes(T){
 return {ink:new T.MeshStandardMaterial({color:'#304554',roughness:.82,metalness:.23}),
  deep:new T.MeshStandardMaterial({color:'#23343d',roughness:.86,metalness:.18}),
  enamel:new T.MeshStandardMaterial({color:'#e3dfd4',roughness:.93,metalness:.035}),
  bronze:new T.MeshStandardMaterial({color:'#957858',roughness:.68,metalness:.56})};
}
function box(T,parent,name,w,h,d,x,y,z,material){
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
 mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function addReceptionName(T,root){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#304554';ctx.fillRect(0,0,512,128);
 ctx.fillStyle='#eee9de';ctx.font='72px "AlgoArt Marker", Georgia';
 ctx.textAlign='center';ctx.fillText('reception',256,88,475);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 const sign=new T.Mesh(new T.PlaneGeometry(1.50,.375),new T.MeshBasicMaterial({map}));
 sign.name='phi-reception-desk-sign';sign.position.set(-.73,.60,-.721);
 sign.rotation.y=Math.PI;root.add(sign);
}
export function addPhiGoldenReceptionDesk(T,scene,reception,elevation){
 if(!reception?.desk)return null;
 const {desk,cabinet}=reception,{width,depth,main,minor,splitX}=phiFurnitureDimensions().desk;
 const m=finishes(T),root=new T.Group();root.name='phi-golden-reception-desk';
 root.position.set(desk.x,elevation,desk.z);
 root.userData.propsLoaded=0;root.userData.phiGeometry={ratio:width/depth,split:[main,minor]};
 scene.add(root);
 const front=-depth/2+.11,majorX=-width/2+main/2,minorX=splitX+minor/2;
 // Actual 61.8/38.2 architecture, not decorative golden-spiral graphics.
 box(T,root,'major-ink-enamel-front',main-.018,.77,.09,majorX,.595,front,m.ink);
 box(T,root,'minor-ivory-enamel-front',minor-.018,.77,.09,minorX,.595,front,m.enamel);
 box(T,root,'phi-division-bronze',.023,.8,.105,splitX,.595,front-.003,m.bronze);
 for(const side of [-1,1])box(T,root,'metal-side',.11,.87,depth-.14,side*(width/2-.10),.56,.05,m.deep);
 box(T,root,'recessed-powder-metal-kick',width-.18,.09,.48,0,.165,.085,m.deep);
 box(T,root,'bronze-floating-reveal',width-.08,.018,depth-.10,0,1.005,0,m.bronze);
 // Surface extends to the original desk footprint. Hologram at (1.55,1.126,-.40) stays clear.
 box(T,root,'golden-countertop-matte-enamel',width,.078,depth,0,1.06,0,m.enamel);
 box(T,root,'bronze-counter-joint',.014,.003,depth*.70,splitX,1.101,0,m.bronze);
 box(T,root,'short-panel-golden-rule',minor*.618,.014,.012,minorX,.24+.74/PHI,front-.058,m.bronze);
 addReceptionName(T,root);
 // The separate storage case adopts the same finishes instead of the wooden magazine model.
 if(cabinet){
  const store=new T.Group();store.name='phi-reception-enamel-storage';
  store.position.set(cabinet.x-desk.x,0,cabinet.z-desk.z);
  store.rotation.y=cabinet.yaw;root.add(store);
  box(T,store,'storage-shell',1.02,.88,.68,0,.48,0,m.deep);
  box(T,store,'storage-enamel-panel',1.02/PHI,.72,.019,-.51+(.51/PHI),.49,-.353,m.enamel);
  box(T,store,'storage-phi-seam',.014,.76,.025,-.51+1.02/PHI,.49,-.373,m.bronze);
  box(T,store,'storage-lip',1.06,.045,.75,0,.943,0,m.ink);
 }
 // Retain the staff chair and its obstacle, but no standing staff figure.
 addPhiOfficeChair(T,root);
 return {root,ready:Promise.resolve([]),
  obstacles:[cabinet,{x:desk.x-.55,z:desk.z+1.65,width:.85,depth:.85,yaw:0,kind:'chair'}].filter(Boolean)};
}
export function addPhiGoldenReceptionBench(T,scene,placement,elevation){
 const {width,depth,main,minor}=phiFurnitureDimensions().bench;
 const m=finishes(T),root=new T.Group();root.name='phi-golden-reception-bench';
 root.position.set(placement.x,elevation,placement.z);root.rotation.y=placement.rotation;
 root.userData.phiGeometry={ratio:width/depth,split:[main,minor]};scene.add(root);
 // One enamel plane at original seat height, with golden split at the leading edge.
 box(T,root,'golden-enamel-seat',width,.08,depth,0,.545,0,m.enamel);
 const start=-width/2;
 box(T,root,'long-ink-front',main-.006,.055,.07,start+main/2,.495,-depth/2+.035,m.ink);
 box(T,root,'short-bronze-front',minor-.006,.055,.07,start+main+minor/2,.495,-depth/2+.035,m.bronze);
 for(const x of [-width/PHI/2,width/PHI/2])
  box(T,root,'recessed-metal-pier',.11,.43,depth*.70,x,.255,0,m.deep);
 box(T,root,'bronze-seat-split',.012,.003,depth*.72,start+main,.587,0,m.bronze);
 return root;
}
