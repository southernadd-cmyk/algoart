// One shared, same-origin generator sandbox for the exhibition.
// All vector geometry is produced by the existing versioned engine.
let framePromise=null;
const waiting=new Map();
let serial=Promise.resolve();
let counter=0;
function createFrame(){
  if(framePromise)return framePromise;
  framePromise=new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    // Resolve from this module: the rehearsal runs under /test/virtual-gallery/.
    frame.src=new URL('./vector-source.html',import.meta.url).href;
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex=-1;
    frame.style.cssText='display:none;width:0;height:0;border:0';
    const timeout=setTimeout(()=>reject(Error('Generator frame loading timed out')),14000);
    function ready(event){
      if(event.origin!==location.origin || event.source!==frame.contentWindow ||
         event.data?.type!=='pp-vector-bridge-ready')return;
      clearTimeout(timeout);
      window.removeEventListener('message',ready);
      resolve(frame);
    }
    window.addEventListener('message',ready);
    frame.onerror=()=>{
      clearTimeout(timeout);window.removeEventListener('message',ready);
      reject(Error('Generator bridge failed to load'));
    };
    document.body.append(frame);
  });
  return framePromise;
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.data?.type!=='pp-vectors-result')return;
  const callback=waiting.get(event.data.id);
  if(!callback)return;
  waiting.delete(event.data.id);
  if(event.data.error)callback.reject(Error(event.data.error));
  else callback.resolve(event.data.result);
});
export function vectorForStudy(study){
  // Enforce one call at a time: svgRecorder is global inside the actual engine.
  const next=serial.catch(()=>{}).then(async()=>{
    if(!study?.href)throw Error('Archived study has no original editor URL');
    const frame=await createFrame();
    const id=++counter;
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{
        waiting.delete(id);reject(Error('Timed out regenerating '+study.seed));
      },20000);
      waiting.set(id,{
        resolve(value){clearTimeout(timeout);resolve(value);},
        reject(error){clearTimeout(timeout);reject(error);}
      });
      frame.contentWindow.postMessage({
        type:'pp-request-vectors',id,url:study.href
      },location.origin);
    });
  });
  serial=next.catch(()=>{});
  return next;
}
