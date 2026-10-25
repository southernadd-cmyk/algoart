// Bake all graffiti paint to PNG atlases after the final daily floor build.
// Uses the exact tower placement/curation modules, not a duplicate renderer.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {buildLayout} from '../gallery/visit/layout-v2.mjs';
import {planGalleryHangs} from '../gallery/visit/hanging-v3.mjs';
import {planExteriorGraffiti,planGraffitiAtlases} from '../gallery/visit/exterior-graffiti-plan.mjs';
import {planInteriorGraffiti} from '../gallery/visit/interior-graffiti-plan.mjs';
const archive=JSON.parse(await fs.readFile('gallery/tower-layouts.json','utf8'));
const requested=process.argv.find(x=>x.startsWith('--date='))?.slice(7)||archive.floors.at(-1)?.date;
if(!/^\d{4}-\d{2}-\d{2}$/.test(requested))throw Error('Expected --date=YYYY-MM-DD');
const level=archive.floors.findIndex(f=>f.date===requested);
if(level<0)throw Error('Date not present in tower-layouts: '+requested);
const BASE=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
try{
 await page.goto(new URL('test/graffiti/',BASE).href);
 await page.waitForFunction(()=>!!document.querySelector('#wall'));
 async function exportAtlas(marks,dir,signature){
  const plans=planGraffitiAtlases(marks,{lowPower:false});
  await fs.mkdir(dir,{recursive:true});
  const manifest={version:1,date:requested,signature,marks:marks.map(m=>({id:m.id,hand:m.hand,seed:m.seed,text:m.text,form:m.form})),pages:[]};
  for(const [n,plan] of plans.entries()){
   const entries=plan.entries.map(({mark,x,y,width,height})=>({tag:mark.tag,bounds:mark.bounds,x,y,width,height}));
   const base64=await page.evaluate(async({entries,size,height})=>{
    const {drawTag}=await import('/test/graffiti/tag-engine.mjs');
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=height;
    const g=canvas.getContext('2d',{alpha:true});
    for(const e of entries){
     g.save();g.beginPath();g.rect(e.x-2,e.y-2,e.width+4,e.height+4);g.clip();
     g.translate(e.x,e.y);g.scale(e.width/e.bounds.width,e.height/e.bounds.height);
     g.translate(-e.bounds.x,-e.bounds.y);drawTag(g,e.tag,{finish:'spray'});g.restore();
    }
    return canvas.toDataURL('image/png').split(',')[1];
   },{entries,size:plan.size,height:plan.height});
   const file='atlas-'+n+'.png';
   await fs.writeFile(path.join(dir,file),Buffer.from(base64,'base64'));
   manifest.pages.push({file,size:plan.size,height:plan.height,entries:plan.entries.length});
  }
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest)+'\n');
  console.log('Baked '+marks.length+' tags into '+plans.length+' atlases: '+dir);
 }
 const floor=archive.floors[level],meta=JSON.parse(await fs.readFile('gallery/'+requested+'/meta.json','utf8'));
 const studies=meta.entries.map((entry,i)=>({id:i,seed:entry.seed,engine:entry.mode,portrait:entry.orientation==='portrait',aspect:entry.orientation==='portrait'?1/1.4:1.4}));
 const layout=buildLayout(requested,studies.length,studies);
 const entry=layout.rooms[0];entry.liftWall=['north','east','south','west'].find(side=>!entry.doors.includes(side));
 if(level===0)entry.entranceWall=['south','east','west','north'].find(side=>side!==entry.liftWall&&!entry.doors.includes(side));
 const hangs=planGalleryHangs(layout,studies);
 const indoor=planInteriorGraffiti({layout,hangs,level});
 const indoorSignature=indoor.map(m=>m.id+'|'+m.hand+'|'+m.seed).join(';');
 await exportAtlas(indoor,path.join('gallery',requested,'3d','graffiti'),indoorSignature);
 // The two exterior levels are stable; republish their atlas after each daily build
 // so existing floor plans and all new script versions remain in sync.
 const outer=archive.floors.slice(0,2).map((f,i)=>({level:i,plan:buildLayout(f.date,f.studies.length,f.studies.map(([seed,engine])=>({seed,engine})))}));
 const outside=planExteriorGraffiti(outer);
 await exportAtlas(outside,'gallery/visit/graffiti-assets/exterior',outside.map(m=>m.id+'|'+m.hand+'|'+m.seed).join(';'));
}finally{await page.close();await browser.close();}
