// Reuse the authoritative V1–V10 SOLO composition engine recorder.
// A separate same-origin iframe contains all the global SVG recorder state.
// Calls are serial and always include the complete immutable archived settings.
let framePromise=null,serial=Promise.resolve(),count=0;
const awaiting=new Map();
function frameReady(){
  if(framePromise)return framePromise;
  framePromise=new Promise((resolve,reject)=>{
    const node=document.createElement('iframe');
    node.src=new URL('./source-capture.html',import.meta.url).href;
    node.hidden=true;node.setAttribute('aria-hidden','true');node.tabIndex=-1;
    node.style.display='none';
    const timeout=setTimeout(()=>reject(Error('Original composition recorder could not initialise')),20000);
    function listener(event){
      if(event.origin!==location.origin||event.source!==node.contentWindow ||
          event.data?.type!=='pp-sculpture-vectors-ready')return;
      clearTimeout(timeout);window.removeEventListener('message',listener);
      resolve(node);
    }
    window.addEventListener('message',listener);
    node.onerror=()=>{clearTimeout(timeout);reject(Error('Source recorder unavailable'));};
    document.body.append(node);
  });
  return framePromise;
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='pp-sculpture-vectors-result')
    return;
  const item=awaiting.get(event.data.id);
  if(!item||event.source!==item.source)return;
  awaiting.delete(event.data.id);
  clearTimeout(item.timeout);
  if(event.data.error)item.reject(Error(event.data.error));
  else item.resolve(event.data.result);
});
export function recordOriginalComposition(entry){
  const job=serial.catch(()=>{}).then(async()=>{
    if(!entry?.settings||!entry.seed||!entry.shareUrl)
      throw Error('Archived study must contain its original settings');
    const frame=await frameReady(),id=++count;
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{
        awaiting.delete(id);reject(Error('Recorder timed out for '+entry.seed));
      },30000);
      awaiting.set(id,{resolve,reject,timeout,source:frame.contentWindow});
      frame.contentWindow.postMessage({
        id,type:'pp-sculpture-vectors-request',
        item:{
          settings:entry.settings,seed:entry.seed,
          shareUrl:entry.shareUrl,rendererVersion:entry.rendererVersion
        }
      },location.origin);
    });
  });
  serial=job.catch(()=>{});
  return job;
}
