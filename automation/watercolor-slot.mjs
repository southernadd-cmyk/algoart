// Watercolor slots are additional posts on the existing London morning/evening triggers.
// No independent cron or extra afternoon slot. The two orientations use separate queues.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCaptions} from './captions.mjs';

const TIMES=['09:00',null,'20:30'];
const b64=x=>Buffer.from(String(x||''),'utf8').toString('base64');
const localDay=()=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const dayString=()=>{const d=localDay();return d.year+'-'+d.month+'-'+d.day};
async function output(obj){
  const rows=Object.entries(obj).map(([k,v])=>k+'='+String(v)).join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,rows);
  else process.stdout.write(rows);
}
export function watercolorSlot(slot){
  if(slot==='build')return {should_run:true,should_post:false,slot:'',target_time:'preview'};
  if(!['0','2'].includes(String(slot)))throw Error('Watercolor publishes in slot 0 or 2 only');
  return {should_run:true,should_post:true,slot:String(slot),target_time:TIMES[Number(slot)]};
}
async function main(){
  const command=process.argv[2]||'gate';
  const date=process.env.SOCIAL_DATE||dayString();
  const orientation=process.env.SOCIAL_ORIENTATION;
  if(!['portrait','landscape'].includes(orientation))throw Error('Missing watercolor orientation');
  if(command==='gate'){
    await output({...watercolorSlot(String(process.env.FORCE_WATERCOLOR_SLOT||'build')),date});
    return;
  }
  if(command==='select'){
    const s=watercolorSlot(String(process.env.SLOT||''));
    const index=s.slot==='0'?0:1;
    const dir=path.resolve('social-output',date,'watercolor',orientation);
    const queue=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
    if(queue.date!==date||queue.material!=='watercolor'||queue.orientation!==orientation||queue.entries.length!==2)
      throw Error('Expected frozen two-study watercolor queue for '+orientation);
    const item=queue.entries[index];
    if(item.material!=='watercolor'||item.orientation!==orientation)throw Error('Watercolor selection mismatch');
    if(new URL(item.shareUrl).searchParams.get('watercolor')!=='1')throw Error('Share link is not watercolor');
    const imagePath=path.join(dir,item.imageFile),igPath=path.join(dir,item.instagramImageFile||item.imageFile);
    await fs.access(imagePath);await fs.access(igPath);
    const captions=makeCaptions(item);
    await output({
      id:item.id,image_path:imagePath,asset_name:item.imageFile,
      instagram_asset_name:item.instagramImageFile||item.imageFile,
      instagram_caption_b64:b64(captions.instagram),threads_caption_b64:b64(captions.threads),
      bluesky_caption_b64:b64(captions.bluesky),
      pinterest_title_b64:b64('Watercolor · '+item.series+' — ALGO/ART'),
      pinterest_description_b64:b64('Procedural watercolor study. Open the exact artwork in ALGO/ART: '+item.shareUrl),
      alt_text_b64:b64(captions.altText),share_url:item.shareUrl,scheduled_time:s.target_time
    });
    return;
  }
  throw Error('Unknown watercolor-slot command: '+command);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
