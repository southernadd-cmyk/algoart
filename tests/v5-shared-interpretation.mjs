// V5 shared composition interpretation — actual material pixels, not AI images.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder='v5-results',server=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
await mkdir(folder,{recursive:true});
const cases=[
  {seed:'V5-MASS-ORGANIC-20261015',mode:'organic',orientation:'portrait',
    density:76,elements:57,complexity:75,negativeSpace:53,palette:'earth'},
  {seed:'V5-MASS-RECTS-20261015',mode:'rects',orientation:'landscape',
    density:63,elements:42,complexity:67,negativeSpace:56,palette:'golden'},
  {seed:'V5-MASS-SPIRAL-20261015',mode:'spiral',orientation:'landscape',
    density:62,elements:36,complexity:60,negativeSpace:58,palette:'neon'}
];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:970},deviceScaleFactor:1});
const faults=[];page.on('pageerror',e=>faults.push(e.message));
const results=[];
try{
  await page.goto(server,{waitUntil:'domcontentloaded',timeout:60000});
  await page.addScriptTag({url:'/js/oil-paint-v4e.js'});
  await page.addScriptTag({url:'/js/composition-interpret-v5.js'});
  await page.addScriptTag({url:'/js/v5-material-adapters.js'});
  // Explicit edge case: a protected rectangle must never receive a mass.
  const synthetic=await page.evaluate(()=>{
    const A=window.AlgoArt,s={seed:'v5-synthetic-void',mode:'rects',
      orientation:'landscape'}, paths=Array.from({length:8},(_,i)=>({
      d:'M '+(80+i*7)+' 175 L '+(270+i*7)+' '+(180+i*4),
      stroke:'#ad653a',width:4
    }));
    const source={paths:paths,meta:{voids:[{x:365,y:120,w:190,h:230}]}};
    const a=A.planCompositionV5FromSource(source,s,{maxRegions:8});
    return {regions:a.regions.length,
      violates:a.regions.some(q=>q.x>365&&q.x<555&&q.y>120&&q.y<350)};
  });
  assert.equal(synthetic.violates,false,'Protected void was painted');
  assert(synthetic.regions>0,'Synthetic grouped geometry must produce regions');
  for(const [i,entry] of cases.entries()){
    const payload=await page.evaluate(async entry=>{
      const A=window.AlgoArt;A.rendererVersion=9;
      const settings={...A.readSettings(),...entry,
        grain:13,paper:'#f5f0e6',colourCount:4,
        saturation:82,brightness:65,
        pen:'fine',thickness:13,wobble:38,overdraw:3,opacity:75,
        lines:true,circles:true,rectangles:true,polygons:true,arcs:true};
      const opts={phiFraming:true,interpretation:'areas',maxRegions:26};
      const before={recorder:A.svgRecorder,phi:A.phiFramingEnabled,
        meta:A.lastRenderMeta};
      const firstPlan=A.planCompositionV5(settings,opts),
            secondPlan=A.planCompositionV5(settings,opts);
      const equalPlan=JSON.stringify(firstPlan)===JSON.stringify(secondPlan);
      const renders={};
      const size=.40;
      for(const material of ['oil','tissue']){
        const faithful=document.createElement('canvas'),
              interpreted=document.createElement('canvas'),
              repeat=document.createElement('canvas');
        const fallback=A.renderInterpretedV5(faithful,settings,size,
          {...opts,material,interpretation:'faithful'});
        const comparison=document.createElement('canvas');
        if(material==='oil'){
          A.renderOilPaintV4E(comparison,settings,size,
            {phiFraming:true,thickness:.90,drag:.72,bristles:.92,
              massing:.44,relief:.87,wetDrag:.72});
        }else{
          const old=A.phiFramingEnabled,meta=A.lastRenderMeta;
          try{
            A.phiFramingEnabled=true;
            A.renderOil(comparison,settings,size,false,7);
          }finally{A.phiFramingEnabled=old;A.lastRenderMeta=meta}
        }
        const preserved=faithful.toDataURL()===comparison.toDataURL();
        const output=A.renderInterpretedV5(interpreted,settings,size,
          {...opts,material});
        const repeatOut=A.renderInterpretedV5(repeat,settings,size,
          {...opts,material});
        const equal=interpreted.toDataURL()===repeat.toDataURL(),
              changed=interpreted.toDataURL()!==faithful.toDataURL(),
              image=interpreted.getContext('2d').getImageData(0,0,
                interpreted.width,interpreted.height).data,
              reference=faithful.getContext('2d').getImageData(0,0,
                faithful.width,faithful.height).data;
        let changedPixels=0;
        for(let j=0;j<image.length;j+=4)if(
          Math.abs(image[j]-reference[j])+
          Math.abs(image[j+1]-reference[j+1])+
          Math.abs(image[j+2]-reference[j+2])>18)changedPixels++;
        renders[material]={preserved,equal,changed,changedPixels,
          stats:output,faithful:faithful.toDataURL('image/png').split(',')[1],
          interpreted:interpreted.toDataURL('image/png').split(',')[1],
          width:faithful.width,height:faithful.height};
      }
      return {settings,plan:firstPlan,equalPlan,renders,
        globalSafe:A.svgRecorder===before.recorder&&
          A.phiFramingEnabled===before.phi};
    },entry);
    assert(payload.equalPlan,'Shared planner is not deterministic for '+entry.mode);
    assert(payload.globalSafe,'V5 contaminated global recorder or φ fit');
    assert(payload.plan.regions.length>=2,
      'No interpreted masses generated for '+entry.mode);
    assert(payload.plan.regions.every(v=>v.sources.length>0));
    assert(payload.plan.regions.every(v=>!v.material),
      'Shared planner must not refer to material-specific physics');
    assert(!payload.plan.regions.some(v=>payload.plan.protectedVoids.some(q=>
      v.x>=q.x&&v.x<=q.x+q.w&&v.y>=q.y&&v.y<=q.y+q.h)),
      'Interpreted region illegally occupies reserved negative space');
    for(const material of ['oil','tissue']){
      const out=payload.renders[material];
      assert(out.preserved,material+' faithful mode changed pixels');
      assert(out.equal,material+' interpreted render is not deterministic');
      assert(out.changed,material+' interpreted mode does not alter image');
      assert(out.changedPixels>700,
        material+' interpretation did not create visible painted regions');
      assert.equal(out.stats.plan.regions.length,payload.plan.regions.length);
      assert.deepEqual(out.stats.plan.regions,payload.plan.regions,
        'Material changed shared plan');
      const prefix=entry.mode+'-'+entry.orientation+'-'+material;
      for(const mode of ['faithful','interpreted']){
        const bytes=Buffer.from(out[mode],'base64');
        assert(bytes.length>14000,material+' missing actual pixels');
        await writeFile(path.join(folder,prefix+'-'+mode+'.png'),bytes);
      }
      console.log('V5 '+entry.mode+' '+material+' regions '+payload.plan.regions.length+
        ' changedPixels '+out.changedPixels+' paint '+JSON.stringify(out.stats.work));
    }
    results.push({
      seed:payload.settings.seed,mode:entry.mode,
      orientation:entry.orientation,
      plan:payload.plan,
      materials:Object.fromEntries(['oil','tissue'].map(m=>[m,{
        faithfulByteIdentical:payload.renders[m].preserved,
        repeatByteIdentical:payload.renders[m].equal,
        changedPixels:payload.renders[m].changedPixels,
        work:payload.renders[m].stats.work,
        renderMs:payload.renders[m].stats.renderMs
      }]))
    });
  }
  // One contact sheet: 4 columns [oil faithful, oil interpreted,
  // tissue faithful, tissue interpreted], 3 rows one per engine.
  const cards=results.flatMap((a)=>['oil','tissue'].flatMap(m=>
    ['faithful','interpreted'].map(type=>({
      label:a.mode.toUpperCase()+' · '+m+' · '+type,
      filename:a.mode+'-'+a.orientation+'-'+m+'-'+type+'.png'
    }))));
  // Actual images from the server-local renderer; the test's PNGs are
  // written before loading the sheet. No introductory modal screenshots.
  const sheet=await page.evaluate(async ({cards,folder})=>{
    const w=1200,h=970,out=document.createElement('canvas');
    out.width=w;out.height=h;const g=out.getContext('2d');
    g.fillStyle='#e9e3db';g.fillRect(0,0,w,h);
    for(let i=0;i<cards.length;i++){
      const item=cards[i],im=new Image();
      im.src='/'+folder+'/'+item.filename;
      await new Promise((ok,bad)=>{im.onload=ok;im.onerror=bad});
      const x=(i%4)*300,y=Math.floor(i/4)*320;
      g.fillStyle='#f5f0e6';g.fillRect(x+7,y+6,286,277);
      const scale=Math.min(280/im.width,273/im.height);
      g.drawImage(im,x+150-im.width*scale/2,
        y+144-im.height*scale/2,im.width*scale,im.height*scale);
      g.fillStyle='#26231f';g.font='12px sans-serif';
      g.fillText(item.label,x+8,y+305);
    }
    return out.toDataURL('image/jpeg',.92).split(',')[1];
  },{cards,folder});
  await writeFile(folder+'/v5-oil-tissue-faithful-vs-areas.jpg',
    Buffer.from(sheet,'base64'));
  await writeFile(folder+'/v5-manifest.json',JSON.stringify({
    version:'V5 prototype optional shared composition interpretation',
    pipeline:'same source geometry -> one material-neutral plan -> two material adapters',
    published:false,sourceRenderedBy:'ALGO/ART procedural engines',
    cases:results
  },null,2));
  assert.deepEqual(faults,[],'Browser exceptions');
  console.log('PASS V5: same plan, oil + tissue adapters, 3 modes, exact faithful copies');
}finally{await browser.close()}
