// An isolated A3-journal capture run. Writes real canvases from the project renderer.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const base='http://127.0.0.1:4173/';
const out='duck-proof';
await fs.mkdir(out,{recursive:true});
const seed='DUCK-PHI-1618';
const settings={seed,elements:'47',density:'56',complexity:'66',negativeSpace:'38',phiStrength:'67',
 recursion:'4',spiralInfluence:'63',goldenAngle:'93',nesting:'44',
 wobble:'32',curveBias:'65',shapeAmount:'64',overlap:'55',rotation:'64',
 colourCount:'5',saturation:'76',brightness:'58',palette:'marker',orientation:'landscape'};
const modes=[['field','Orbital Studies'],['spiral','Golden Trajectories'],['rects','Recursive Divisions'],
 ['burst','Radiant Systems'],['network','Connected Fields'],['organic','Growth Systems'],
 ['geometric','Constructed Forms'],['scribble','Automatic Marks']];
const materials=[['marker','Marker'],['tissue','Tissue & Graphite'],
 ['watercolour','Watercolour'],['oil','Oil Paint'],['action','Action Painting']];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl',
 '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const log=[];const errors=[];
const page=await browser.newPage({viewport:{width:1500,height:1150},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>{try{localStorage.setItem('algoart-intro-seen','1');}catch(e){}});
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.AlgoArt&&typeof window.AlgoArt.readSettings==='function'&&document.querySelector('#art'),null,{timeout:60000});
 const sample=async (mode,material,label)=>{
  await page.evaluate(({mode,material,settings})=>{
    const $=id=>document.getElementById(id);
    for(const [id,value] of Object.entries(settings)){
      const el=$(id);if(el)el.value=value;
    }
    $('mode').value=mode;
    $('materialStyle').value=material;
    // A single real settings event calls the site's own material renderer.
    $('materialStyle').dispatchEvent(new Event('change',{bubbles:true}));
  },{mode,material,settings});
  await page.waitForFunction(()=>{
    return document.querySelector('#creatingOverlay')?.hidden===true &&
      window.AlgoArt?.renderTimings?.fullMs>0;
  },null,{timeout:180000});
  await page.waitForTimeout(300);
  const result=await page.evaluate(()=>{
    const canvas=document.querySelector('#art'),a=window.AlgoArt;
    return {data:canvas.toDataURL('image/png').split(',')[1],
      width:canvas.width,height:canvas.height,
      settings:a.readSettings(),material:document.querySelector('#materialStyle').value,
      status:document.querySelector('#statsText').textContent};
  });
  if(!result.data||result.width!==1400||result.height!==1000)throw Error('Bad canvas '+label+' '+JSON.stringify(result).slice(0,200));
  const bytes=Buffer.from(result.data,'base64');
  if(bytes.length<12000)throw Error('Suspicious blank canvas '+label+' '+bytes.length);
  const file=label+'.png';await fs.writeFile(path.join(out,file),bytes);
  const hash=createHash('sha256').update(bytes).digest('hex');
  log.push({file,mode,material,seed,width:result.width,height:result.height,
    bytes:bytes.length,sha256:hash,settings:result.settings,status:result.status});
  console.log('ARTWORK '+label+' '+bytes.length+' '+result.status);
 };
 for(let i=0;i<modes.length;i++)await sample(modes[i][0],'marker',
    'engine_'+String(i+1).padStart(2,'0')+'_'+modes[i][0]);
 for(let i=0;i<materials.length;i++)await sample('geometric',materials[i][0],
    'material_'+String(i+1).padStart(2,'0')+'_'+materials[i][0]);
 // Verify real artist-controlled settings (only material changes).
 const comparable=x=>{const s={...x.settings};delete s.mode;return JSON.stringify(s)};
 const materialRows=log.filter(x=>x.file.startsWith('material_'));
 if(new Set(materialRows.map(x=>JSON.stringify(x.settings))).size!==1)
   throw Error('MATERIAL CONTROLS DIFFER: '+JSON.stringify(materialRows.map(x=>x.settings)));
 await fs.writeFile(path.join(out,'render-manifest.json'),JSON.stringify({seed,settings,
  engines:modes,materials,records:log,pageErrors:errors},null,2));
 // Genuine unaltered WebGL tower frames from external low-angle positions.
 await page.goto(base+'gallery/visit/?debug=1',{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,
   null,{timeout:240000});
 const startupError=await page.evaluate(()=>window.__galleryStartupError||'');
 if(startupError)throw Error('Tower startup: '+startupError);
 await page.locator('#enter').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#welcome')?.hidden&&window.__phiReceptionPreview?.duckExterior,
   null,{timeout:90000});
 await page.waitForTimeout(1400);
 await page.addStyleTag({content:'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'});
 const viewpoints=[
 {file:'tower_outside_low_01.jpg',x:35,z:-65,targetY:66,fov:78},
 {file:'tower_outside_low_02.jpg',x:18,z:-88,targetY:79,fov:80},
 {file:'tower_outside_low_03.jpg',x:-36,z:-85,targetY:84,fov:78},
 {file:'tower_outside_low_04.jpg',x:53,z:-98,targetY:90,fov:72},
 {file:'tower_outside_low_05.jpg',x:75,z:-135,targetY:87,fov:60},
 ];
 for(const v of viewpoints){
   const camera=await page.evaluate(({x,z,targetY,fov})=>
       window.__phiReceptionPreview.duckExterior(x,z,targetY,fov),v);
   await page.waitForTimeout(650);
   const bytes=await page.screenshot({path:path.join(out,v.file),type:'jpeg',quality:92,timeout:90000});
   if(bytes.length<15000)throw Error('Tower capture too small: '+v.file);
   console.log('TOWER '+v.file+' '+bytes.length);
 }
 await fs.writeFile(path.join(out,'tower-viewpoints.json'),JSON.stringify(viewpoints,null,2));
 console.log('DONE '+log.length+' artwork canvases and '+viewpoints.length+' real exterior screenshots');
}finally{
 await page.close().catch(()=>{});
 await browser.close();
}
