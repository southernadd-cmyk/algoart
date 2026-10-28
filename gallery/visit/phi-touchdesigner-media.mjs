// TouchDesigner output is OPTIONAL and never part of tower startup.
// A published manifest and a valid browser video are required before replacing
// the lightweight canvases on the three test-only reception monitors.

export const TOUCHDESIGNER_TRIPTYCH_MANIFEST = new URL('./touchdesigner/phase-one.json',import.meta.url);
export const TOUCHDESIGNER_ACTIVE_INDEX = new URL('./touchdesigner/active.json',import.meta.url);
export function isSafeTouchDesignerManifestPath(path){return path==='phase-one.json'||(/^daily\/\d{4}-\d{2}-\d{2}\.json$/.test(path));}

export function validateTouchDesignerTriptych(data){
 if(!data || data.version!==1 || !data.triptych)return null;
 if(data.status!=='published')return null;
 const t=data.triptych;
 if(t.panelCount!==3 || t.layout!=='horizontal' ||
    t.panelWidth!==384 || t.panelHeight!==240 ||
    t.width!==1152 || t.height!==240 ||
    !Number.isFinite(t.fps) || t.fps<1 || t.fps>30)return null;
 if(typeof t.file!=='string'|| !(/^(phase-one-triptych|\d{4}-\d{2}-\d{2})\.webm$/.test(t.file)))return null;
 return {file:t.file,width:t.width,height:t.height,panelWidth:t.panelWidth,panelHeight:t.panelHeight};
}

export function createTouchDesignerMonitorMedia(THREE,{screens,manifestURL=TOUCHDESIGNER_TRIPTYCH_MANIFEST}){
 let state='fallback',started=false,disposed=false,video=null,texture=null,material=null,activeManifest=manifestURL;
 let playerActive=false,playerStarting=false,lastError='',originalUVs=[];
 const setState=next=>{state=next;};
 const diag=()=>({state,error:lastError,videoReady:!!video&&video.readyState>=2,playing:playerActive,manifest:activeManifest.pathname});
 const restore=()=>{
  screens.forEach((screen,i)=>{
   if(originalUVs[i]){
    const uv=screen.geometry.getAttribute('uv');
    originalUVs[i].forEach((value,j)=>uv.setX(j,value));
    uv.needsUpdate=true;
   }
   if(screen.userData.fallbackMaterial)screen.material=screen.userData.fallbackMaterial;
  });
  originalUVs=[];
  if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
  if(texture){texture.dispose();texture=null;}
  if(material){material.dispose();material=null;}
  playerActive=false;playerStarting=false;
 };
 const fail=error=>{
  if(disposed)return;
  lastError=String(error?.message||error);
  restore();setState('fallback');
 };
 async function start(){
  if(started||disposed)return;
  started=true;setState('checking-export');
  let manifest;
  try{
   // The active pointer changes only after a locally rendered and verified
   // daily WebM is committed. Missing index retains the proven Phase 1 work.
   try{
    const indexResponse=await fetch(TOUCHDESIGNER_ACTIVE_INDEX,{cache:'no-store'});
    if(indexResponse.ok){
     const index=await indexResponse.json();
     if(index?.version===1&&isSafeTouchDesignerManifestPath(index.manifest))
      activeManifest=new URL(index.manifest,TOUCHDESIGNER_ACTIVE_INDEX);
    }
   }catch{ /* Keep Phase 1 when index is offline. */ }
   if(disposed)return;
   const response=await fetch(activeManifest,{cache:'no-store'});
   if(!response.ok)throw new Error('TouchDesigner manifest HTTP '+response.status);
   manifest=await response.json();
   if(disposed)return;
   const media=validateTouchDesignerTriptych(manifest);
   if(!media){setState('awaiting-export');return;}
   const source=new URL(media.file,activeManifest);
   // The manifest may not redirect media to another host or path.
   if(source.origin!==activeManifest.origin ||
      !source.pathname.startsWith(new URL('.',activeManifest).pathname))
     throw new Error('TouchDesigner media must be same-origin');
   setState('loading-export');
   const element=document.createElement('video');
   video=element;
   element.muted=true;element.defaultMuted=true;element.loop=true;
   element.playsInline=true;element.preload='auto';
   element.setAttribute('playsinline','');
   element.src=source.href;
   await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('TouchDesigner video timed out')),8000);
    const done=(err)=>{
     clearTimeout(timeout);
     element.removeEventListener('loadeddata',onLoad);
     element.removeEventListener('error',onError);
     err?reject(err):resolve();
    };
    const onLoad=()=>done();
    const onError=()=>done(new Error('TouchDesigner video could not be decoded'));
    element.addEventListener('loadeddata',onLoad,{once:true});
    element.addEventListener('error',onError,{once:true});
    element.load();
   });
   if(disposed)return;
   if(element.videoWidth!==media.width||element.videoHeight!==media.height)
    throw new Error('Incorrect TouchDesigner video dimensions');
   texture=new THREE.VideoTexture(element);
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.minFilter=THREE.LinearFilter;
   texture.magFilter=THREE.LinearFilter;
   material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
   screens.forEach((screen,i)=>{
    const uv=screen.geometry.getAttribute('uv');
    originalUVs[i]=Array.from({length:uv.count},(_,j)=>uv.getX(j));
    for(let j=0;j<uv.count;j++)uv.setX(j,(i+originalUVs[i][j])/3);
    uv.needsUpdate=true;
    screen.userData.fallbackMaterial=screen.material;
    screen.material=material;
   });
   setState('export-ready');
  }catch(error){fail(error);}
 }
 function update(nearby){
  if(disposed)return;
  if(nearby&&!started)void start();
  if(!video||state==='fallback'||state==='awaiting-export')return;
  if(nearby && !playerActive && !playerStarting && video.readyState>=2){
   // Avoid duplicate play() requests while the first autoplay promise settles.
   playerStarting=true;
   video.play().then(()=>{playerStarting=false;if(!disposed){playerActive=true;setState('playing-export');}}).catch(error=>{playerStarting=false;fail(error);});
  }else if(!nearby&&playerActive){
   video.pause();playerActive=false;setState('export-ready');
  }
 }
 function dispose(){
  disposed=true;
  restore();
  setState('disposed');
 }
 return {update,dispose,diagnostics:diag,get usingExport(){return state==='playing-export'||state==='export-ready';}};
}
