// Portrait-only scheduler: intentionally independent of social-slot.mjs so
// existing landscape posting times, selectors, and idempotency do not change.
import fs from 'node:fs/promises';
import path from 'node:path';
import {TIME_ZONE, PORTRAIT_SCHEDULE, PORTRAIT_POST_INDICES} from './config.mjs';

function localParts(date = new Date()){
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date).map(part=>[part.type,part.value]));
}
const mins = text => {const [h,m]=text.split(':').map(Number);return h*60+m;};
const b64 = text => Buffer.from(String(text||''),'utf8').toString('base64');
const dateText = p => `${p.year}-${p.month}-${p.day}`;
async function output(obj){
  const data=Object.entries(obj).map(([key,value])=>`${key}=${String(value)}`).join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,data);
  else process.stdout.write(data);
}

export function scheduleDecision({date=new Date(),force='',forcedDate=''}={}){
  const now=localParts(date),clock=Number(now.hour)*60+Number(now.minute);
  const day=forcedDate||dateText(now);
  if(force==='build')return {should_run:true,should_post:false,phase:'build',date:day,slot:'',target_time:'06:00'};
  if(force!==''&&!['0','1','2'].includes(force))throw Error('Invalid portrait slot: '+force);
  if(force!==''){
    const slot=Number(force);
    return {should_run:true,should_post:true,phase:'post',date:day,slot,target_time:PORTRAIT_SCHEDULE[slot]};
  }
  if(clock<mins('06:00'))return {should_run:false,should_post:false,phase:'skip',date:day,slot:'',target_time:''};
  const slot=[2,1,0].find(i=>clock>=mins(PORTRAIT_SCHEDULE[i]));
  if(slot===undefined)return {should_run:true,should_post:false,phase:'build',date:day,slot:'',target_time:'06:00'};
  return {should_run:true,should_post:true,phase:'post',date:day,slot,target_time:PORTRAIT_SCHEDULE[slot]};
}

async function main(){
  const command=process.argv[2]||'gate';
  const day=process.env.SOCIAL_DATE||dateText(localParts());
  if(command==='gate'){
    const decision=scheduleDecision({
      force:String(process.env.FORCE_PORTRAIT_SLOT||'').trim(),
      forcedDate:process.env.SOCIAL_DATE||''
    });
    await output({...decision,local_time:(()=>{const p=localParts();return p.hour+':'+p.minute})()});
    return;
  }
  if(command==='select'){
    const slot=Number(process.env.SLOT);
    if(!Number.isInteger(slot)||slot<0||slot>=PORTRAIT_SCHEDULE.length)throw Error('Invalid portrait SLOT');
    const queuePath=path.resolve('social-output',day,'portrait','queue.json');
    const queue=JSON.parse(await fs.readFile(queuePath,'utf8'));
    if(queue.orientation!=='portrait'||queue.entries.length!==5)throw Error('Expected a five-artwork portrait batch');
    const item=queue.entries[PORTRAIT_POST_INDICES[slot]];
    if(item?.settings?.orientation!=='portrait')throw Error('Selected artwork is not portrait');
    const imagePath=path.resolve('social-output',day,'portrait',item.imageFile);
    await fs.access(imagePath);
    const assetName=item.imageFile;
    if(!item.instagramImageFile)throw Error('Portrait is missing Instagram-safe image');
    await fs.access(path.resolve('social-output',day,'portrait',item.instagramImageFile));
    await output({
      id:item.id,
      image_path:imagePath,
      asset_name:assetName,
      instagram_asset_name:item.instagramImageFile,
      instagram_caption_b64:b64(item.copy.instagram),
      threads_caption_b64:b64(item.copy.threads),
      bluesky_caption_b64:b64(item.copy.bluesky),
      pinterest_title_b64:b64('Portrait · '+item.series+' — ALGO/ART'),
      pinterest_description_b64:b64('Portrait study from ALGO/ART. Exact seed and settings available to remix. '+item.shareUrl),
      alt_text_b64:b64(item.copy.altText),
      share_url:item.shareUrl,
      scheduled_time:PORTRAIT_SCHEDULE[slot]
    });
    return;
  }
  throw Error('Unknown portrait-slot command: '+command);
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
  await main();
}
