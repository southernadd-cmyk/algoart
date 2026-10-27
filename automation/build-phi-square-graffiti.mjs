// Build the live golden-spiral square atlases from the exact runtime planner.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {planSquareWallAtlases,SQUARE_ATLAS_PREFIX} from '../gallery/visit/square-graffiti-atlas.mjs';
import {towerGraffitiSignature,TOWER_LETTERING_REVISION} from '../gallery/visit/tower-family-lettering.mjs';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
try{
 for(const variant of ['live','test']){
 globalThis.__phiReceptionTestRefresh=variant==='test';
 const {planPhiSquare,planSquareTags,PHI_SQUARE_REVISION}=await import('../gallery/visit/phi-square-graffiti.mjs?'+variant);
 const marks=planSquareTags(planPhiSquare());
 await page.goto('http://127.0.0.1:4173/test/graffiti/',{waitUntil:'domcontentloaded'});
 for(const material of ['brick','concrete']){
  const subset=marks.filter(mark=>mark.material===material);
  for(const lowPower of [false,true]){
   const plans=planSquareWallAtlases(subset,{lowPower});
   const dir=path.join('gallery/visit/graffiti-assets/square',variant==='live'?'live':'',material,lowPower?'mobile':'desktop');
   await fs.mkdir(dir,{recursive:true});
   const manifest={version:1,letteringRevision:TOWER_LETTERING_REVISION,
    date:'__phi_reception__',squareRevision:PHI_SQUARE_REVISION,
    signature:SQUARE_ATLAS_PREFIX+towerGraffitiSignature(subset),
    marks:subset.map(m=>({id:m.id,hand:m.hand,seed:m.seed,text:m.phrase,form:m.form})),pages:[]};
   for(const [i,plan] of plans.entries()){
    const entries=plan.entries.map(({mark,x,y,width,height})=>({tag:mark.tag,phrase:mark.phrase,bounds:mark.bounds,x,y,width,height}));
    const base64=await page.evaluate(async({entries,size,height})=>{
     const [{paintSquareWall},{paintExteriorUnderstroke}]=await Promise.all([
      import('/gallery/visit/square-graffiti-atlas.mjs'),
      import('/gallery/visit/exterior-graffiti.mjs')]);
     const canvas=document.createElement('canvas');canvas.width=size;canvas.height=height;
     const g=canvas.getContext('2d',{alpha:true});
     for(const e of entries){
      g.save();g.beginPath();g.rect(e.x-2,e.y-2,e.width+4,e.height+4);g.clip();
      g.translate(e.x,e.y);g.scale(e.width/e.bounds.width,e.height/e.bounds.height);g.translate(-e.bounds.x,-e.bounds.y);
      paintSquareWall(g,e.tag,{width:e.width,height:e.height,paintUnderstroke:paintExteriorUnderstroke});
      g.restore();
     }
     return canvas.toDataURL('image/png').split(',')[1];
    },{entries,size:plan.size,height:plan.height});
    const filename='wall-atlas-'+i+'.png';
    await fs.writeFile(path.join(dir,filename),Buffer.from(base64,'base64'));
    manifest.pages.push({file:filename,size:plan.size,height:plan.height,entries:plan.entries.length});
   }
   await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest)+'\n');
   console.log(dir+': '+subset.length+' marks, '+plans.length+' PNG pages, '+manifest.signature.slice(0,72));
  }
 }
} } finally {await page.close();await browser.close();}

