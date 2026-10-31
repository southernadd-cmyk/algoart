// Predecode only the selected floor's paintings during the lift journey.
export function decodePhiArtworkImage(url) {
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.crossOrigin='anonymous';image.decoding='async';
  image.onload=()=>Promise.resolve(typeof image.decode==='function'?image.decode():undefined)
   .catch(()=>{}).then(()=>resolve(image));
  image.onerror=()=>reject(new Error('Painting image unavailable: '+url));
  image.src=globalThis.__phiJPEGCacheBench?.stamp(url)||url;
 });
}
export function createPhiArtworkPreloader(loadImage=decodePhiArtworkImage,{concurrency=3,prepare=null,dispose=()=>{}}={}){
 let current=null;
 const limit=Math.max(1,Math.floor(concurrency));
 const clear=()=>{
  if(!current)return;
  const old=current;current=null;old.cancelled=true;
  // Skip queued downloads and dispose GPU textures that were never claimed
  // by a destination floor. Claimed textures belong to their wall materials.
  for(const entry of old.entries.values())if(entry.state==='ready'&&!entry.claimed)dispose(entry.value);
  for(const entry of old.queue)entry.finish(null);
  old.queue.length=0;old.entries.clear();
 };
 const start=(date,urls)=>{
  clear();
  const entries=new Map(),queue=[];
  for(const url of urls){
   if(typeof url!=='string'||!url||entries.has(url))continue;
   let finish;
   const promise=new Promise(resolve=>{finish=resolve;});
   const entry={url,promise,finish,state:'queued',claimed:false,value:null};
   entries.set(url,entry);queue.push(entry);
  }
  const session={date,entries,queue,active:0,cancelled:false};
  current=session;
  const pump=()=>{
   if(session.cancelled)return;
   while(session.active<limit&&queue.length){
    const entry=queue.shift();
    entry.state='loading';session.active++;
    Promise.resolve().then(()=>loadImage(entry.url))
     .then(image=>prepare?prepare(image,{date,url:entry.url,isCancelled:()=>session.cancelled}):image)
     .then(value=>{
      if(session.cancelled){dispose(value);entry.finish(null);return;}
      entry.state='ready';entry.value=value;entry.finish(value);
     },()=>{
      entry.state='failed';entry.finish(null);
     }).finally(()=>{session.active--;pump();});
   }
  };
  pump();
 };
 const take=(date,url)=>{const entry=current?.date===date?current.entries.get(url):null;
  if(!entry)return null;
  entry.claimed=true;
  return entry.promise;
 };
 const stats=()=>current?{
  date:current.date,total:current.entries.size,
  ready:[...current.entries.values()].filter(x=>x.state==='ready').length,
  loading:current.active,pending:current.queue.length
 }:{date:null,total:0,ready:0,loading:0,pending:0};
 return {start,take,clear,stats};
}
