import {isTouchDesignerMotionPaused,subscribeTouchDesignerMotionChange} from './phi-touchdesigner-motion.mjs';

// TouchDesigner output is OPTIONAL and never part of tower startup.
// A published manifest and a valid browser video are required before replacing
// the lightweight canvases. The six-screen atlas shares one decoder and texture.

export const TOUCHDESIGNER_TRIPTYCH_MANIFEST = new URL('./touchdesigner/phase-one.json',import.meta.url);
export const TOUCHDESIGNER_SIX_SCREEN_MANIFEST = new URL('./touchdesigner/six-screen.json',import.meta.url);
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
 if(typeof t.file!=='string'|| !(/^(phase-one-triptych|watercolour-burst-AA-20261005-03-55769-triptych|\d{4}-\d{2}-\d{2})\.webm$/.test(t.file)))return null;
 return {file:t.file,width:t.width,height:t.height,panelWidth:t.panelWidth,panelHeight:t.panelHeight};
}

export function validateTouchDesignerSixScreen(data){
 if(!data || data.version!==1 || data.status!=='published')return null;
 const a=data.atlas;
 if(!a || a.file!=='six-screen-installation.webm' || a.layout!=='grid' ||
    a.columns!==3 || a.rows!==2 || a.panelCount!==6 ||
    a.panelWidth!==384 || a.panelHeight!==240 ||
    a.width!==1152 || a.height!==480 ||
    !Number.isFinite(a.fps) || a.fps<1 || a.fps>30)return null;
 return {file:a.file,width:a.width,height:a.height,panelWidth:a.panelWidth,
  panelHeight:a.panelHeight,columns:a.columns,rows:a.rows};
}

export function hasTouchDesignerVideoLooped(previousTime,currentTime){
 return Number.isFinite(previousTime)&&Number.isFinite(currentTime)&&
  previousTime-currentTime>.5;
}
export function createTouchDesignerMonitorMedia(THREE,{screens,manifestURL=TOUCHDESIGNER_TRIPTYCH_MANIFEST,followActiveIndex=true}){
 let state='fallback',started=false,disposed=false,video=null,texture=null,material=null,activeManifest=manifestURL;
 let playerActive=false,playerStarting=false,lastError='',originalUVs=[];
 let playbackLoop=0,lastPlaybackTime=0;
 let lastAdvanceTime=0,lastAdvanceAt=0,stallRecoveries=0;
 const setState=next=>{state=next;};
 const diag=()=>({state,error:lastError,videoReady:!!video&&video.readyState>=2,playing:playerActive,paused:video?.paused??null,motionPaused:isTouchDesignerMotionPaused(),stallRecoveries,manifest:activeManifest.pathname});
 const unsubscribeMotion=subscribeTouchDesignerMotionChange(()=>{
  // Pause immediately on a visitor gesture or OS preference change; do not
  // wait for the next scene update or reintroduce the old proximity bug.
  if(!isTouchDesignerMotionPaused()||!video)return;
  if(!video.paused)video.pause();
  playerActive=false;lastAdvanceAt=0;
  if(state==='playing-export')setState('export-ready');
 });
 const restore=()=>{
  screens.forEach((screen,i)=>{
   if(originalUVs[i]){
    const uv=screen.geometry.getAttribute('uv');
    originalUVs[i].forEach(([x,y],j)=>uv.setXY(j,x,y));
    uv.needsUpdate=true;
   }
   if(screen.userData.fallbackMaterial)screen.material=screen.userData.fallbackMaterial;
  });
  originalUVs=[];
  if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
  if(texture){texture.dispose();texture=null;}
  if(material){material.dispose();material=null;}
  playerActive=false;playerStarting=false;
  playbackLoop=0;lastPlaybackTime=0;lastAdvanceTime=0;lastAdvanceAt=0;stallRecoveries=0;
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
   if(followActiveIndex)try{
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
   const media=manifest.atlas?validateTouchDesignerSixScreen(manifest):validateTouchDesignerTriptych(manifest);
   if(!media){setState('awaiting-export');return;}
   const columns=media.columns??3,rows=media.rows??1;
   if(screens.length!==columns*rows)throw new Error('Incorrect TouchDesigner screen count');
   const source=new URL(media.file,activeManifest);
   // The manifest may not redirect media to another host or path.
   if(source.origin!==activeManifest.origin ||
      !source.pathname.startsWith(new URL('.',activeManifest).pathname))
     throw new Error('TouchDesigner media must be same-origin');
   // Cache-bust updated six-screen films by the verified manifest digest.
   if(typeof manifest.atlas?.sha256==='string'&&/^[0-9a-f]{64}$/.test(manifest.atlas.sha256))
    source.searchParams.set('v',manifest.atlas.sha256.slice(0,16));
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
   // Upload the decoded opening frame even when autoplay is suppressed.
   texture.needsUpdate=true;
   texture.minFilter=THREE.LinearFilter;
   texture.magFilter=THREE.LinearFilter;
   material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
   screens.forEach((screen,i)=>{
    const uv=screen.geometry.getAttribute('uv');
    originalUVs[i]=Array.from({length:uv.count},(_,j)=>[uv.getX(j),uv.getY(j)]);
    const column=i%columns,row=Math.floor(i/columns);
    // Video's top row occupies the upper half of the texture's UV space.
    for(let j=0;j<uv.count;j++){
     const [x,y]=originalUVs[i][j];
     uv.setXY(j,(column+x)/columns,(rows-1-row+y)/rows);
    }
    uv.needsUpdate=true;
    screen.userData.fallbackMaterial=screen.material;
    screen.material=material;
   });
   setState('export-ready');
  }catch(error){fail(error);}
 }
 function update(nearby){
  if(disposed)return;
  // Approaching the installation starts the two lazy video decoders once.
  // Leaving a monitor's 11m radius must NOT pause a film: the large screens
  // in the next room borrow the same videos, and proximity can fluctuate.
  if(nearby&&!started)void start();
  if(!video||state==='fallback'||state==='awaiting-export')return;
  const element=video;
  // Only suspend media when the whole browser tab is hidden. Reception
  // disposal already stops both players when leaving this floor by lift.
  if(document.hidden===true||isTouchDesignerMotionPaused()){
   if(playerActive||!element.paused)element.pause();
   playerActive=false;lastAdvanceAt=0;
   if(state==='playing-export')setState('export-ready');
   return;
  }
  if(element.readyState>=2){
   const time=element.currentTime,now=performance.now();
   if(hasTouchDesignerVideoLooped(lastPlaybackTime,time))playbackLoop++;
   lastPlaybackTime=time;
   if(!lastAdvanceAt){lastAdvanceAt=now;lastAdvanceTime=time;}
   if(Math.abs(time-lastAdvanceTime)>.025){
    lastAdvanceAt=now;lastAdvanceTime=time;stallRecoveries=0;
   }else if(playerActive&&!element.paused&&now-lastAdvanceAt>4000){
    // Some browsers resolve play() but then stop decoding a detached video.
    // Retry a bounded number of times; never leave a permanently frozen wall.
    if(++stallRecoveries>=3){fail(new Error('TouchDesigner playback stalled'));return;}
    element.pause();playerActive=false;lastAdvanceAt=now;
   }
  }
  if(!playerStarting&&element.readyState>=2&&(!playerActive||element.paused)){
   // A successful play() promise isn't proof playback will continue: also
   // observe paused/currentTime on subsequent ticks for recovery.
   playerStarting=true;
   Promise.resolve(element.play()).then(()=>{
    playerStarting=false;
    if(!disposed&&video===element&&document.hidden!==true&&!isTouchDesignerMotionPaused()){
     playerActive=true;setState('playing-export');
    }else if(video===element){element.pause();playerActive=false;}
   }).catch(error=>{playerStarting=false;if(!disposed&&video===element)fail(error);});
  }
 }
 function dispose(){
  disposed=true;
  unsubscribeMotion();
  restore();
  setState('disposed');
 }
 return {update,dispose,diagnostics:diag,
  get playbackLoop(){return playbackLoop;},
  get usingExport(){return state==='playing-export'||state==='export-ready';}};
}
