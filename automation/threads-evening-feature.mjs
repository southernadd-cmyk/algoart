// One evening Threads post, selected from the already-published daily archive.
// The afternoon Watercolour/Oil and morning Action/Tissue can all be featured
// without creating extra Threads posts or changing the full artwork schedule.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCaptions} from './captions.mjs';

export const EVENING_MATERIAL_ROTATION=Object.freeze([
  'watercolour','oil','action','watercolor','marker'
]);
const dayNumber=date=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid archive date');
  const d=new Date(date+'T12:00:00Z');
  if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==date)
    throw Error('Invalid archive day '+date);
  return Math.floor(d.valueOf()/86_400_000);
};
export function selectEveningThreadsArtwork(entries,date){
  if(!Array.isArray(entries)||entries.length===0)throw Error('Empty daily gallery archive');
  const day=dayNumber(date);
  const preferred=EVENING_MATERIAL_ROTATION[
    ((day%EVENING_MATERIAL_ROTATION.length)+EVENING_MATERIAL_ROTATION.length)%
    EVENING_MATERIAL_ROTATION.length
  ];
  const ordered=[
    preferred,
    ...EVENING_MATERIAL_ROTATION.filter(material=>material!==preferred)
  ];
  // Favour portrait/landscape alternation and stable artwork IDs.
  const orientation=day%2===0?'portrait':'landscape';
  for(const material of ordered){
    const candidates=entries.filter(item=>
      (item.material||'marker')===material && item.id && item.imageFile && item.shareUrl
    );
    if(!candidates.length)continue;
    const portraitCandidates=candidates.filter(item=>item.orientation===orientation);
    const pool=portraitCandidates.length?portraitCandidates:candidates;
    const sorted=[...pool].sort((a,b)=>a.id.localeCompare(b.id));
    return sorted[(day+1)%sorted.length];
  }
  throw Error('No archive artwork suitable for the Threads evening post');
}

async function main(){
  const date=process.env.SOCIAL_DATE;
  dayNumber(date);
  const folder=path.resolve('gallery',date);
  const archive=JSON.parse(await fs.readFile(path.join(folder,'meta.json'),'utf8'));
  const item=selectEveningThreadsArtwork(archive.entries,date);
  const imagePath=path.resolve(folder,item.imageFile);
  if(!imagePath.startsWith(folder+path.sep))throw Error('Unsafe archive image path');
  const file=await fs.stat(imagePath);
  if(!file.isFile()||file.size<100)throw Error('Archive media unavailable '+item.imageFile);
  const copy=makeCaptions(item);
  const values={
    image_path:imagePath,
    asset_name:'algoart-'+date+'-evening-threads.jpg',
    caption_b64:Buffer.from(copy.threads).toString('base64'),
    alt_text_b64:Buffer.from(item.altText||copy.altText).toString('base64'),
    artwork_id:item.id,
    material:item.material||'marker'
  };
  const rows=Object.entries(values).map(([key,value])=>key+'='+value).join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,rows);
  else process.stdout.write(rows);
  console.log('Evening Threads featured artwork:',item.id,item.material||'marker');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
