// Reception information row: optional network preview, fixed-position explanation
// and clickable .toe project download. Media remains deferred until approached.
const PREVIEW=new URL('./touchdesigner/td-network-loop.webp',import.meta.url);
const LOGO=new URL('./touchdesigner/touchdesigner-logo.png',import.meta.url);
const PROJECT=new URL('./touchdesigner/pp_translation_room_watercolour.toe',import.meta.url);

export function getTouchDesignerHereLines(customLines=null){
 const standard=['HERE: SOURCE → CONTOURS →','DISPLACEMENT + FEEDBACK'];
 return Array.isArray(customLines)&&customLines.length===2&&customLines.every(line=>typeof line==='string'&&line.trim())?customLines:standard;
}

export function getTouchDesignerInfoPanelIndices(showNetworkPreview=true){
 return showNetworkPreview?[0,1,2]:[1,2];
}

export function addTouchDesignerInfoRow(THREE,{root,width,height,gap,rowPitch,camera,hereLines=null,previewURL=PREVIEW,projectURL=PROJECT,showNetworkPreview=true}){
 const material=new THREE.MeshStandardMaterial({color:0x181a1c,metalness:.32,roughness:.48});
 const lamp=new THREE.MeshBasicMaterial({color:0x66c59d,toneMapped:false});
 const textures=[],screens=[],contexts=[],groups=[];
 const panelIndices=getTouchDesignerInfoPanelIndices(showNetworkPreview);
 let image=null,video=null,videoPlayPending=false,logo=null,attempted=false,disposed=false,available=false,availabilityChecked=false,frame=0,last=0;
 const statuses={preview:'not-requested',logo:'not-requested',project:'not-checked'};
 const [hereLine1,hereLine2]=getTouchDesignerHereLines(hereLines);
 function text(ctx,t,x,y,size=18,color='#eee9da',weight='normal',family='Arial, sans-serif'){
  ctx.fillStyle=color;ctx.font=weight+' '+size+'px '+family;ctx.fillText(t,x,y);
 }
 function base(ctx){
  ctx.clearRect(0,0,384,240);
  ctx.fillStyle='#151b20';ctx.fillRect(0,0,384,240);
 }
 function draw(index){
  const c=contexts[index];base(c);
  if(index===0){
   if((video?.readyState>=2&&video.videoWidth)||(image?.complete&&image.naturalWidth)){
    const source=video?.readyState>=2&&video.videoWidth?video:image;
    const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;
    const scale=Math.min(384/sw,240/sh);
    c.drawImage(source,(384-sw*scale)/2,(240-sh*scale)/2,sw*scale,sh*scale);
    c.fillStyle='rgba(12,15,20,.75)';c.fillRect(0,210,384,30);
    text(c,'TOUCHDESIGNER · LIVE NETWORK',12,230,13,'#f8f3ea','bold');
   }else{
    text(c,'TOUCHDESIGNER NETWORK',25,76,23,'#f5eee5','bold');
    text(c,'A working node-based visual model',25,116,17,'#d3cbbd');
    text(c,statuses.preview==='not-found'?'ANIMATION FILE PENDING':'Network walkthrough',25,164,14,'#86cfb1');
   }
  }else if(index===1){
   c.fillStyle='#25363b';c.fillRect(0,0,384,5);
   text(c,'WHAT IS TOUCHDESIGNER?',18,39,23,'#f4eee4','bold');
   text(c,'A visual programming environment',18,82,18,'#f1e6d1');
   text(c,'by Derivative, used to create',18,106,18,'#f1e6d1');
   text(c,'real-time interactive artwork.',18,130,18,'#f1e6d1');
   c.fillStyle='#31454a';c.fillRect(15,151,354,1);
   text(c,hereLine1,18,178,17,'#a9d5bd','bold');
   text(c,hereLine2,18,202,17,'#a9d5bd','bold');
   text(c,'PROPORTION PIECE · TRANSLATION ROOM',18,225,11,'#c4b5a1');
  }else{
   c.fillStyle='#f8f8f8';c.fillRect(0,0,384,149);
   if(logo?.complete&&logo.naturalWidth){
    const w=356,h=Math.min(105,w*logo.naturalHeight/logo.naturalWidth);
    c.drawImage(logo,(384-w)/2,(149-h)/2,w,h);
   }else{
    c.fillStyle='#252525';c.beginPath();c.arc(36,65,13,0,Math.PI*2);c.arc(58,79,12,0,Math.PI*2);c.arc(37,98,11,0,Math.PI*2);c.fill();
    text(c,'TOUCHDESIGNER',78,71,26,'#171717','bold');
    text(c,'B Y  D E R I V A T I V E',81,98,13,'#242424');
   }
   c.fillStyle=available?'#23483f':'#485157';
   c.fillRect(0,149,384,91);
   text(c,available?'CLICK TO DOWNLOAD .TOE':'TOUCHDESIGNER PROJECT',17,184,22,'#f9f7ef','bold');
   text(c,available?'Editable TouchDesigner network':'Project file awaiting publication',18,212,16,'#dde9e1');
  }
  textures[index].needsUpdate=true;
 }
 for(const i of panelIndices){
  const group=new THREE.Group();
  group.name='living-monitor-'+(i+7);
  group.position.set((i-1)*(width+gap),-2*rowPitch,0);
  const bezel=new THREE.Mesh(new THREE.BoxGeometry(width,height,.075),material);
  bezel.name='monitor-bezel';group.add(bezel);
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=240;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('Canvas rendering unavailable for TouchDesigner information row');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width-.065,height-.067),
    new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide}));
  face.position.z=.041;face.name='monitor-screen';
  group.add(face);
  const indicator=new THREE.Mesh(new THREE.BoxGeometry(.024,.012,.006),lamp);
  indicator.position.set(width/2-.047,-height/2+.014,.042);group.add(indicator);
  root.add(group);groups.push(group);screens[i]=face;contexts[i]=ctx;textures[i]=texture;
 }
 for(const i of panelIndices)draw(i);
 const pos=new THREE.Vector3(),eye=new THREE.Vector3(),ray=new THREE.Raycaster();
 function near(distance=11){return root.getWorldPosition(pos).distanceTo(camera.getWorldPosition(eye))<distance;}
 function load(){
  if(attempted||disposed)return;
  attempted=true;
  if(showNetworkPreview && previewURL.pathname.toLowerCase().endsWith('.webm')){
   video=document.createElement('video');video.muted=true;video.defaultMuted=true;
   video.playsInline=true;video.loop=true;video.preload='metadata';
   video.setAttribute('playsinline','');
   video.addEventListener('loadeddata',()=>{statuses.preview='ready';if(!disposed)draw(0)});
   video.addEventListener('error',()=>{statuses.preview='not-found';if(!disposed)draw(0)});
   statuses.preview='loading';video.src=previewURL.href;video.load();
  }else if(showNetworkPreview){
   image=new Image();image.decoding='async';
   image.onload=()=>{statuses.preview='ready';if(!disposed)draw(0)};
   image.onerror=()=>{statuses.preview='not-found';if(!disposed)draw(0)};
   statuses.preview='loading';image.src=previewURL.href;
  }
  logo=new Image();logo.decoding='async';
  logo.onload=()=>{statuses.logo='ready';if(!disposed)draw(2)};
  logo.onerror=()=>{statuses.logo='not-found';if(!disposed)draw(2)};
  statuses.logo='loading';logo.src=LOGO.href;
  // Do not advertise a download that is a 404.
  fetch(projectURL,{method:'HEAD',cache:'no-store'}).then(r=>{
   if(disposed)return;available=r.ok;availabilityChecked=true;
   statuses.project=available?'ready':'not-found';draw(2);
  }).catch(()=>{if(disposed)return;availabilityChecked=true;statuses.project='not-found';draw(2)});
 }
 function update(time,close){
  if(disposed)return;
  if(close)load();
  if(!close&&video&&!video.paused)video.pause();
  if(close&&video?.readyState>=2&&video.paused&&!videoPlayPending){
   videoPlayPending=true;
   Promise.resolve(video.play()).then(()=>{videoPlayPending=false}).catch(()=>{
    videoPlayPending=false;statuses.preview='playback-blocked';
   });
  }
  if(!showNetworkPreview||!close||(!(video?.readyState>=2&&video.videoWidth)&&!(image?.complete&&image.naturalWidth)))return;
  if(time-last<150)return; // max 7 canvas uploads/sec, only near the screens.
  last=time;frame++;draw(0);
 }
 function onClick(e){
  if(disposed||!available||!near(5))return;
  if(e.button!==0)return;
  const canvas=document.getElementById('world')||document.querySelector('canvas');
  if(!canvas)return;
  const locked=document.pointerLockElement===canvas||document.pointerLockElement===document.body;
  if(!locked&&e.target!==canvas)return;
  if(locked){
   ray.setFromCamera(new THREE.Vector2(0,0),camera);
  }else{
   const rect=canvas.getBoundingClientRect();
   ray.setFromCamera(new THREE.Vector2(
    (e.clientX-rect.left)/rect.width*2-1,
    -(e.clientY-rect.top)/rect.height*2+1),camera);
  }
  root.updateWorldMatrix(true,true);
  if(!ray.intersectObject(screens[2],false).length)return;
  e.preventDefault();
  // Open the actual downloadable .toe only on the real pointer gesture.
  window.open(projectURL.href,'_blank','noopener,noreferrer');
 }
 document.addEventListener('pointerup',onClick,true);
 return {screens,groups,panelCount:groups.length,panelIndices,
  get diagnostics(){return {...statuses,visiblePanelIndices:panelIndices,visiblePanelCount:groups.length,
   framesDrawn:frame,previewKind:showNetworkPreview?(video?'webm':'webp'):'none',
   videoTime:video?.currentTime??null,downloadReady:available,checked:availabilityChecked}},
  update,dispose(){
   disposed=true;document.removeEventListener('pointerup',onClick,true);
   if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
   textures.forEach(t=>t.dispose());
   screens.forEach(x=>{x.material.dispose();x.geometry.dispose()});
   groups.forEach(group=>{group.children.forEach(x=>{if(x.geometry&&!screens.includes(x))x.geometry.dispose()});root.remove(group)});
   material.dispose();lamp.dispose();
  }
 };
}
