// Action painting: exactly one portrait and one landscape at the
// existing 09:00 Europe/London afternoon trigger. Historical "watercolor"
// remains Tissue & Graphite at the morning/evening slots.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCaptions} from './captions.mjs';

const b64=text=>Buffer.from(String(text||''),'utf8').toString('base64');
function today(){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).map(v=>[v.type,v.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
export function actionSlot(slot){
  if(slot==='build')return {should_run:true,should_post:false,slot:'',target_time:'preview'};
  if(String(slot)!=='0')throw Error('v1 Action posts only at morning slot 0, 09:00 UK');
  return {should_run:true,should_post:true,slot:'0',target_time:'09:00'};
}
export function validateActionItem(item,day,orientation){
  if(!item||item.material!=='action'||item.orientation!==orientation||
     item.rendererVersion!==9||
     !new RegExp('^'+day+'-'+(orientation==='portrait'?'ACP':'ACL')+'01$').test(item.id))
    throw Error('Invalid Action artwork identity');
  const link=new URL(item.shareUrl);
  if(!['action-v1','action-v2'].includes(link.searchParams.get('material'))||
     link.searchParams.get('v')!=='9'||
     link.searchParams.get('seed')!==item.seed||
     link.searchParams.get('mode')!==item.mode||
     link.searchParams.get('fmt')!==(orientation==='portrait'?'portrait':null)){
    // URLSearchParams returns null when landscape format is omitted.
    throw Error('Action share URL does not reproduce saved artwork');
  }
}
async function output(values){
  const data=Object.entries(values).map(([key,value])=>key+'='+String(value)).join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,data);
  else process.stdout.write(data);
}
async function main(){
  const command=process.argv[2]||'gate';
  const date=process.env.SOCIAL_DATE||today();
  const orientation=process.env.SOCIAL_ORIENTATION;
  if(!['portrait','landscape'].includes(orientation))throw Error('Missing Action orientation');
  if(command==='gate'){
    await output({...actionSlot(process.env.FORCE_ACTION_SLOT||'build'),date});
    return;
  }
  if(command==='select'){
    const gate=actionSlot(process.env.SLOT||'');
    const dir=path.resolve('social-output',date,'action',orientation);
    const q=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
    if(q.date!==date||q.material!=='action'||q.orientation!==orientation||
       !Array.isArray(q.entries)||q.entries.length!==1)
      throw Error('Expected one frozen Action v1 study in '+orientation);
    const item=q.entries[0];
    validateActionItem(item,date,orientation);
    const image=path.join(dir,item.imageFile);
    const instagram=path.join(dir,item.instagramImageFile||item.imageFile);
    await fs.access(image);await fs.access(instagram);
    const copy=makeCaptions(item);
    await output({
      id:item.id,image_path:image,asset_name:item.imageFile,
      instagram_asset_name:item.instagramImageFile||item.imageFile,
      instagram_caption_b64:b64(copy.instagram),
      threads_caption_b64:b64(copy.threads),
      bluesky_caption_b64:b64(copy.bluesky),
      pinterest_title_b64:b64('Action · '+item.series+' — ALGO/ART'),
      pinterest_description_b64:b64('Action v1 study. Open the exact artwork: '+item.shareUrl),
      alt_text_b64:b64(copy.altText),share_url:item.shareUrl,
      scheduled_time:gate.target_time
    });
    return;
  }
  throw Error('Unknown action-slot command: '+command);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
