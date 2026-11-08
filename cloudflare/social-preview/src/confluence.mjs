// Independent Confluence social cards. Every URL maps to a short, verified
// persisted snapshot of all three artists and a JPEG of the actual canvas.
const SITE='https://southernadd-cmyk.github.io/algoart/confluence/';
const ORIGIN='https://southernadd-cmyk.github.io';
const VALID_SYSTEMS=new Set(['field','spiral','rects','burst','network','organic','geometric','scribble']);
const VALID_MATERIALS=new Set(['marker','tissue','watercolour','oil','action']);
const VALID_TURNS=new Set([5,8,13,21,34,55,89,144,233,377,610,987,1597,2584]);
const CORS={'access-control-allow-origin':ORIGIN,'vary':'Origin',
 'cache-control':'no-store','x-content-type-options':'nosniff'};
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reply=(t,status=400,extra={})=>new Response(t,{status,headers:{
  'content-type':'text/plain; charset=utf-8','cache-control':'no-store',...extra}});
const validNum=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
function validateState(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||s.v!==1||
   typeof s.seed!=='string'||s.seed.length<1||s.seed.length>64||
   /[<>\x00-\x1f]/.test(s.seed)||
   !['portrait','landscape'].includes(s.orientation)||
   typeof s.paper!=='string'||!/^#[0-9a-f]{6}$/i.test(s.paper)||
   !validNum(s.grain,0,100)||!['weave','echo','space'].includes(s.response)||
   !validNum(s.strength,0,100)||!validNum(s.collaborationPull,0,100)||
   !VALID_TURNS.has(s.totalTurns)||!Array.isArray(s.artists)||s.artists.length!==3)return false;
 return s.artists.every(a=>{
   if(!a||!VALID_SYSTEMS.has(a.system)||
     typeof a.palette!=='string'||!/^[a-z0-9_-]{1,32}$/.test(a.palette)||
     !VALID_MATERIALS.has(a.material)||!a.settings||
     typeof a.settings!=='object'||Array.isArray(a.settings))return false;
   const settings=Object.entries(a.settings);
   return settings.length<=45 && settings.every(([k,v])=>
     /^[A-Za-z][A-Za-z0-9_-]{0,32}$/.test(k)&&
     ((typeof v==='boolean')||(typeof v==='number'&&Number.isFinite(v)&&v>=-100&&v<=300)||
       (typeof v==='string'&&v.length<=64&&!/[<>\x00-\x1f]/.test(v))));
 });
}
function dimensions(bytes){
 if(bytes.length<10||bytes[0]!==0xff||bytes[1]!==0xd8||
   bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return null;
 const b=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let i=2;
 while(i<bytes.length-9){
   if(bytes[i++]!==0xff)continue;
   const marker=bytes[i++];
   if([0xd8,0xd9,0x01].includes(marker))continue;
   if(i+2>bytes.length)break;
   const n=b.getUint16(i);i+=2;
   if(n<2||i+n-2>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3].includes(marker)&&n>=7)
     return {height:b.getUint16(i+1),width:b.getUint16(i+3)};
   i+=n-2;
 }
 return null;
}
function encode(state) {
 const s=JSON.stringify(state);
 const bytes=new TextEncoder().encode(s);
 let t='';for(const b of bytes)t+=String.fromCharCode(b);
 return btoa(t).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function card(id,state,origin){
 const cardURL=origin+'/confluence/share?id='+id;
 const imgURL=origin+'/confluence/image?id='+id;
 const dest=SITE+'?s='+encode(state);
 const title='Confluence — PROPORTION PIECE';
 const description='A shared composition by three drawing systems. Each responds to the others on one sheet.';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'">'+
 '<meta property="og:type" content="website"><meta property="og:site_name" content="PROPORTION PIECE">'+
 '<meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'">'+
 '<meta property="og:url" content="'+esc(cardURL)+'">'+
 '<meta property="og:image" content="'+esc(imgURL)+'">'+
 '<meta property="og:image:secure_url" content="'+esc(imgURL)+'">'+
 '<meta property="og:image:type" content="image/jpeg">'+
 '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'+
 '<meta name="twitter:card" content="summary_large_image">'+
 '<meta name="twitter:title" content="'+esc(title)+'"><meta name="twitter:image" content="'+esc(imgURL)+'">'+
 '</head><body style="background:#ece7d9;color:#403931;padding:2rem;font-family:Georgia,serif">'+
 '<h1>Confluence</h1><p>Three drawing systems on one canvas.</p><a href="'+esc(dest)+'">Open composition</a>'+
 '<script>location.replace('+JSON.stringify(dest).replace(/</g,'\\u003c')+')</script>'+
 '</body></html>';
}
export async function handleConfluence(request,env){
 const url=new URL(request.url);
 if(!['/confluence/share','/confluence/image','/confluence/preload'].includes(url.pathname))
   return reply('Not found',404);
 if(!env.PREVIEW_KV)return reply('Preview storage not configured',503);
 const put=url.pathname==='/confluence/preload';
 if(put){
   if(request.headers.get('Origin')!==ORIGIN)return reply('Origin not allowed',403,CORS);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
     ...CORS,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type',
     'access-control-max-age':'600'}});
   if(request.method!=='POST')return reply('Method not allowed',405,CORS);
   if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
     return reply('Expected JSON',415,CORS);
   if(Number(request.headers.get('content-length')||0)>450000)
     return reply('Payload too large',413,CORS);
   let data;
   try{
     const raw=await request.arrayBuffer();
     if(raw.byteLength>450000)return reply('Payload too large',413,CORS);
     data=JSON.parse(new TextDecoder().decode(raw));
   }catch{return reply('Invalid JSON',400,CORS)}
   if(!validateState(data?.state)||typeof data.jpeg!=='string'||data.jpeg.length>390000||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(data.jpeg))return reply('Invalid composition or JPEG',400,CORS);
   let image;
   try{image=Uint8Array.from(atob(data.jpeg),c=>c.charCodeAt(0))}
   catch{return reply('Invalid JPEG',400,CORS)}
   const size=dimensions(image);
   if(!size||size.width!==1200||size.height!==630||
     image.length<4000||image.length>285000)return reply('Invalid JPEG size',400,CORS);
   const json=JSON.stringify(data.state);
   if(json.length>11000)return reply('Composition too large',413,CORS);
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json));
   const id=Array.from(new Uint8Array(digest).slice(0,12),b=>b.toString(16).padStart(2,'0')).join('');
   await Promise.all([
     env.PREVIEW_KV.put('confluence/state/'+id,json),
     env.PREVIEW_KV.put('confluence/image/'+id+'.jpg',image.buffer)
   ]);
   const link=url.origin+'/confluence/share?id='+id;
   return Response.json({ok:true,id,url:link,bytes:image.length},{headers:CORS});
 }
 if(!['GET','HEAD'].includes(request.method))return reply('Method not allowed',405,{allow:'GET, HEAD'});
 const id=url.searchParams.get('id');
 if(!/^[a-f0-9]{24}$/.test(id||''))return reply('Invalid composition link',400);
 if(url.pathname==='/confluence/image'){
   const bytes=await env.PREVIEW_KV.get('confluence/image/'+id+'.jpg','arrayBuffer');
   if(!bytes)return reply('Image not available',404);
   return new Response(request.method==='HEAD'?null:bytes,{status:200,headers:{
     'content-type':'image/jpeg','cache-control':'public,max-age=86400',
     'x-content-type-options':'nosniff'}});
 }
 const raw=await env.PREVIEW_KV.get('confluence/state/'+id,'text');
 if(!raw)return reply('Composition not found',404);
 let state;try{state=JSON.parse(raw)}catch{return reply('Corrupt composition',500)}
 if(!validateState(state))return reply('Invalid composition',500);
 return new Response(request.method==='HEAD'?null:card(id,state,url.origin),{status:200,headers:{
   'content-type':'text/html;charset=utf-8','cache-control':'public,max-age=120',
   'x-content-type-options':'nosniff'}});
}
export const testing={validateState,dimensions,card,encode};
