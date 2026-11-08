// Select exactly one archived Confluence image for each featured social slot.
// Slot 0 (09:00 London): first portrait. Slot 2 (20:30): first landscape.
// Every platform receives the same exact picture and gallery permalink.
import fs from 'node:fs/promises';
import path from 'node:path';

const date=process.env.SOCIAL_DATE;
const slot=String(process.env.SOCIAL_SLOT);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'') || date<'2026-11-09')
  throw Error('Confluence social publication requires a gallery date from 2026-11-09.');
if(!['0','2'].includes(slot))
  throw Error('Confluence social publishing only runs at standard morning/evening slots.');
const orientation=slot==='0'?'portrait':'landscape';
const meta=JSON.parse(await fs.readFile(path.join('gallery',date,'meta.json'),'utf8'));
const confluence=meta.entries.filter(e=>e.material==='confluence');
if(confluence.length!==4||confluence.filter(e=>e.orientation==='portrait').length!==2||
  confluence.filter(e=>e.orientation==='landscape').length!==2)
  throw Error('Daily Confluence archive is incomplete; refuse to publish an unverified image.');
const pick=confluence.find(e=>e.orientation===orientation);
if(!pick||!pick.imageFile||!pick.shareUrl||!Array.isArray(pick.artists)||pick.artists.length!==3)
  throw Error('Missing exact Confluence social metadata.');
const state=new URL(pick.shareUrl);
if(!state.pathname.endsWith('/confluence/')||!state.searchParams.has('s'))
  throw Error('Confluence social link does not restore the shared study.');
const imagePath=path.resolve('gallery',date,pick.imageFile);
await fs.access(imagePath);
const galleryUrl='https://southernadd-cmyk.github.io/algoart/gallery/'+date+'/#'+pick.id;
const caption='PROPORTION PIECE / CONFLUENCE\n'+
  'Three systems. One shared drawing.\n'+
  (orientation==='portrait'?'Portrait':'Landscape')+' collaboration · '+date+'\n'+
  galleryUrl+'\n#GenerativeArt #AlgorithmicArt';
const alt=(pick.altText||'Three procedural artists sharing a Confluence drawing.').slice(0,500);
const output={
  orientation,date,study_id:pick.id,image_path:imagePath,share_url:galleryUrl,
  caption_b64:Buffer.from(caption,'utf8').toString('base64'),
  alt_text_b64:Buffer.from(alt,'utf8').toString('base64'),
  pinterest_title_b64:Buffer.from('PROPORTION PIECE / CONFLUENCE — '+orientation,'utf8').toString('base64'),
  pinterest_description_b64:Buffer.from(('Three systems, one shared drawing. '+caption).slice(0,500),'utf8').toString('base64')
};
if([...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(caption)].length>300)
  throw Error('Confluence caption exceeds Bluesky length limit.');
if(process.env.GITHUB_OUTPUT)
  await fs.appendFile(process.env.GITHUB_OUTPUT,Object.entries(output).map(([k,v])=>k+'='+v).join('\n')+'\n');
else console.log(JSON.stringify({...output,caption,alt},null,2));
