// Confluence sharing: each post gets a preview of the actual shared canvas.
// A short Worker card is created only after a user clicks a social button.
// Direct bookmark links include the full three-artist configuration.
const WORKER = 'https://proportion-piece-social.mr-adam-clement.workers.dev';
const MAX_STATE = 10000;
const VALID_MATERIALS = new Set(['marker','tissue','watercolour','oil','action']);
const arrayToBase64 = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function toToken(obj) {
  return arrayToBase64(new TextEncoder().encode(JSON.stringify(obj)));
}
function fromToken(raw) {
  if (!raw || raw.length > MAX_STATE || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const normalized=raw.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-raw.length%4)%4);
    const bytes=Uint8Array.from(atob(normalized),s=>s.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch{return null}
}
const validColor = s => /^#[0-9a-f]{6}$/i.test(s);
function checkState(data) {
  return data && data.v === 1 && typeof data.seed === 'string' && data.seed.length > 0 && data.seed.length <= 64 &&
    ['portrait','landscape'].includes(data.orientation) && validColor(data.paper) &&
    Number.isFinite(data.grain) && data.grain>=0 && data.grain<=100 &&
    ['weave','echo','space'].includes(data.response) &&
    Number.isFinite(data.strength) && data.strength>=0 && data.strength<=100 &&
    Number.isFinite(data.collaborationPull) && data.collaborationPull>=0 && data.collaborationPull<=100 &&
    Number.isFinite(data.totalTurns) && data.totalTurns>=5 && data.totalTurns<=2584 &&
    Array.isArray(data.artists) && data.artists.length===3 &&
    data.artists.every(a=>a && typeof a.system==='string' && typeof a.palette==='string' &&
      VALID_MATERIALS.has(a.material) && a.settings && typeof a.settings==='object' &&
      !Array.isArray(a.settings) && Object.keys(a.settings).length<=45);
}
export function restoreSharedState(params, artists, inputs, catalog) {
  const data=fromToken(params.get('s'));
  if (!checkState(data)) return false;
  const possibleSystems = new Set(catalog.systems.map(s=>s.id));
  // Historical Confluence links may contain the now-retired custom
  // "signature" palette. Preserve their composition settings while mapping
  // that palette to the established Full Spectrum palette.
  if(!data.artists.every(a=>possibleSystems.has(a.system) &&
      (a.palette==='signature'||Object.hasOwn(catalog.palettes,a.palette)) &&
      Object.hasOwn(catalog.materials,a.material)))
    return false;
  inputs.seed.value=data.seed;
  inputs.orientation.value=data.orientation;
  inputs.paper.value=data.paper;
  inputs.grain.value=String(data.grain);
  inputs.response.value=data.response;
  inputs.strength.value=String(data.strength);
  inputs.collaborationPull.value=String(data.collaborationPull);
  if(![...inputs.totalTurns.options].some(o=>o.value===String(data.totalTurns)))
    inputs.totalTurns.add(new Option(data.totalTurns+' turns',String(data.totalTurns)));
  inputs.totalTurns.value=String(data.totalTurns);
  // Each property is restricted to a known editor setting, preserving its
  // existing type and widget range. Unknown URL keys are ignored.
  data.artists.forEach((from,i)=>{
    const to=artists[i];to.system=from.system;to.palette=from.palette==='signature'?'spectrum':from.palette;to.material=from.material;
    for(const [key,value] of Object.entries(from.settings)){
      if(!Object.hasOwn(to.settings,key))continue;
      const original=to.settings[key];
      if(typeof original==='number' && typeof value==='number' && Number.isFinite(value) &&
        value>=0 && value<=160) to.settings[key]=value;
      else if(typeof original==='boolean' && typeof value==='boolean')to.settings[key]=value;
      else if(typeof original==='string' && typeof value==='string' && value.length<=64)
        to.settings[key]=value;
    }
  });
  document.getElementById('grain-value').value=inputs.grain.value;
  document.getElementById('strength-value').value=inputs.strength.value+'%';
  return true;
}
function studyURL(snapshot) {
  const url=new URL('./',window.location.href);
  url.search='?s='+toToken(snapshot);
  url.hash='';
  return url.href;
}
function previewJPEG(canvas) {
  const c=document.createElement('canvas');c.width=1200;c.height=630;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#ece7d9';ctx.fillRect(0,0,c.width,c.height);
  const scale=Math.min(1160/canvas.width,600/canvas.height);
  const w=Math.round(canvas.width*scale),h=Math.round(canvas.height*scale);
  ctx.drawImage(canvas,(1200-w)/2,(630-h)/2,w,h);
  for(const quality of [.79,.66,.52,.39]) {
    const data=c.toDataURL('image/jpeg',quality).split(',')[1];
    if(data.length<365000)return data;
  }
  throw new Error('This preview is too complex to prepare; try Save PNG.');
}
const socialTarget = (platform,url) => {
  const caption='PROPORTION PIECE / CONFLUENCE\nThree systems. One shared drawing.\n\n'+url;
  switch(platform){
    case 'x':return 'https://x.com/intent/tweet?text='+encodeURIComponent(caption+'\n\n#GenerativeArt');
    case 'threads':return 'https://www.threads.com/intent/post?text='+encodeURIComponent(caption);
    default:return 'https://bsky.app/intent/compose?text='+encodeURIComponent(caption);
  }
};
export function bindSharing({canvas, ready, snapshot}) {
  const $=id=>document.getElementById(id);
  const buttons=['share-x','share-threads','share-bluesky','share-native','copy-study-link'];
  const status=$('sharing-status');
  const setStatus=t=>{status.textContent=t};
  function sync(){for(const id of buttons)$(id).disabled=!ready()}
  async function preload(state){
    const result=await fetch(WORKER+'/confluence/preload',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({state,jpeg:previewJPEG(canvas)})
    });
    if(!result.ok)throw new Error('Could not prepare the social image ('+result.status+').');
    const data=await result.json();
    if(!data?.url||!data?.id)throw new Error('The preview service returned an invalid link.');
    return data.url;
  }
  for(const platform of ['x','threads','bluesky']){
    $('share-'+platform).addEventListener('click',async event=>{
      if(!ready())return;
      const trigger=event.currentTarget;
      const tab=window.open('about:blank','_blank');
      trigger.disabled=true;
      setStatus('Preparing an image of this exact drawing…');
      try {
        const url=await preload(snapshot());
        const target=socialTarget(platform,url);
        if(tab && !tab.closed)tab.location.replace(target);
        else window.open(target,'_blank','noopener');
        setStatus('Opening '+platform+' draft with artwork preview. Nothing has been posted.');
      } catch(error){
        // The preview Worker is optional. Preserve the one-click draft when
        // its deployment credentials or KV service are unavailable.
        const direct=studyURL(snapshot());
        const target=socialTarget(platform,direct);
        if(tab && !tab.closed)tab.location.replace(target);
        else window.open(target,'_blank','noopener');
        setStatus('Image preview is unavailable. Opened the '+platform+
          ' draft with your exact Confluence link; no thumbnail is guaranteed.');
      } finally{sync()}
    });
  }
  $('copy-study-link').addEventListener('click',async()=>{
    if(!ready())return;
    const url=studyURL(snapshot());
    try{
      await navigator.clipboard.writeText(url);
      setStatus('Exact Confluence drawing link copied.');
    }catch{
      setStatus('Could not copy automatically. Select and copy this URL: '+url);
    }
  });
  $('share-native').addEventListener('click',async()=>{
    if(!ready())return;
    if(!navigator.share){
      setStatus('Your browser does not support sharing images. Use Save PNG instead.');
      return;
    }
    const url=studyURL(snapshot());
    try {
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(
        value=>value?resolve(value):reject(new Error('PNG export failed')), 'image/png'));
      const file=new File([blob],'confluence-'+snapshot().seed.replace(/[^a-zA-Z0-9_-]/g,'_')+'.png',
        {type:'image/png'});
      const data={title:'Confluence — PROPORTION PIECE',
        text:'Three systems, one shared drawing.',url,files:[file]};
      if(!navigator.canShare?.(data)){
        // A URL-only share must be clearly described as such, not as an image.
        await navigator.share({title:data.title,text:data.text,url:data.url});
        setStatus('Shared the composition link. For the actual image use Save PNG.');
      }else{
        await navigator.share(data);
        setStatus('Shared the Confluence image via your device.');
      }
    }catch(error){
      setStatus('Share cancelled or unavailable. You can still use Save PNG.');
    }
  });
  sync();
  return {sync};
}
