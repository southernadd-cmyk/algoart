// Capture real PROPORTION PIECE marker-engine images in eight distinct existing palettes.
// Only isolated branch. The five-material comparison remains unchanged.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='duck-palette-proof';
await fs.mkdir(out,{recursive:true});
const seed='DUCK-PHI-1618';
const variants=[
 ['field','Orbital Studies','cmyk'],
 ['spiral','Golden Trajectories','cold'],
 ['rects','Recursive Divisions','earth'],
 ['burst','Radiant Systems','neon'],
 ['network','Connected Fields','pastel'],
 ['organic','Growth Systems','warm'],
 ['geometric','Constructed Forms','mono'],
 ['scribble','Automatic Marks','golden']
];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
const records=[];
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
try{
 await page.addInitScript(()=>{try{localStorage.setItem('algoart-intro-seen','1')}catch(e){}});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.AlgoArt&&window.AlgoArt.readSettings&&document.querySelector('#art'),null,{timeout:60000});
 for(let i=0;i<variants.length;i++){
  const [mode,name,palette]=variants[i];
  await page.evaluate(({seed,mode,palette})=>{
   const $=id=>document.getElementById(id);
   $('seed').value=seed;
   $('materialStyle').value='marker';
   $('mode').value=mode;
   $('palette').value=palette;
   $('colourCount').value='6';
   $('saturation').value='80';
   $('brightness').value='53';
   $('paper').value='#f5f0e6';
   $('palette').dispatchEvent(new Event('change',{bubbles:true}));
  },{seed,mode,palette});
  await page.waitForFunction(()=>document.getElementById('creatingOverlay')?.hidden===true &&
      window.AlgoArt?.renderTimings?.fullMs>0,null,{timeout:90000});
  await page.waitForTimeout(250);
  const result=await page.evaluate(()=>{
   const $=id=>document.getElementById(id),canvas=$('art');
   return {png:canvas.toDataURL('image/png').split(',')[1],
    settings:window.AlgoArt.readSettings(),
    width:canvas.width,height:canvas.height,status:$('statsText').textContent,
    material:$('materialStyle').value};
  });
  if(result.settings.palette!==palette||result.settings.mode!==mode||result.settings.seed!==seed||result.material!=='marker')
   throw Error('Renderer settings mismatch: '+JSON.stringify({mode,palette,settings:result.settings,material:result.material}));
  if(result.width!==1400||result.height!==1000)throw Error('Unexpected canvas '+result.width+' '+result.height);
  const buf=Buffer.from(result.png,'base64');
  const filename='engine_'+String(i+1).padStart(2,'0')+'_'+mode+'_'+palette+'.png';
  await fs.writeFile(out+'/'+filename,buf);
  records.push({filename,engine:name,mode,palette,material:'marker',seed,sha256:createHash('sha256').update(buf).digest('hex'),bytes:buf.length,rendererSettings:result.settings});
  console.log('CAPTURED',filename,buf.length);
 }
 if(new Set(records.map(r=>r.palette)).size!==8||records.length!==8)throw Error('Insufficient palette variation');
 await fs.writeFile(out+'/palette-manifest.json',JSON.stringify({source:'Actual PROPORTION PIECE marker renderer, unaltered PNG captures',records},null,2));
}finally{await page.close().catch(()=>{});await browser.close();}
