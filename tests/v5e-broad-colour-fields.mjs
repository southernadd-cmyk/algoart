// V5 shared composition interpretation — actual material pixels, not AI images.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder='v5e-results',server=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
await mkdir(folder,{recursive:true});
const cases=[
  {seed:'V5-MASS-ORGANIC-20261015',mode:'organic',orientation:'portrait',
    density:76,elements:57,complexity:75,negativeSpace:53,palette:'earth'},
  {seed:'V5-MASS-RECTS-20261015',mode:'rects',orientation:'landscape',
    density:63,elements:42,complexity:67,negativeSpace:56,palette:'golden'},
  {seed:'V5-MASS-SPIRAL-20261015',mode:'spiral',orientation:'landscape',
    density:62,elements:36,complexity:60,negativeSpace:58,palette:'neon'},
  {seed:'V5D-CONSTRUCTED-20261015',mode:'geometric',orientation:'landscape',
    density:63,elements:42,complexity:63,negativeSpace:53,palette:'earth'}
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
  await page.addScriptTag({url:'/js/composition-territories-v5c.js'});
  await page.addScriptTag({url:'/js/v5c-material-adapters.js'});
  await page.addScriptTag({url:'/js/composition-guides-v5d.js'});
  await page.addScriptTag({url:'/js/v5d-material-adapters.js'});
  await page.addScriptTag({url:'/js/composition-colour-fields-v5e.js'});
  await page.addScriptTag({url:'/js/v5e-material-adapters.js'});
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
  const territoriesSynthetic=await page.evaluate(()=>{
    const A=window.AlgoArt,source={
      paths:Array.from({length:8},(_,i)=>{
        const col=i%2===0?'#bc623d':'#627c84';
        const x=50+(i%4)*140,y=60+Math.floor(i/4)*140;
        return {d:'M '+(x+8)+' '+(y+8)+' L '+(x+118)+' '+(y+20)+
          ' L '+(x+112)+' '+(y+110),stroke:col,width:3};
      }),
      meta:{guide:{type:'rects',variant:'MOSAIC',
        cells:Array.from({length:8},(_,i)=>({
          x:50+(i%4)*140,y:60+Math.floor(i/4)*140,w:124,h:122,depth:2
        }))},voids:[{x:190,y:60,w:124,h:122}]}
    };
    const settings={seed:'v5c-semantic-synthetic',mode:'rects',
      orientation:'landscape'};
    const plan=A.planCompositionV5FromSource(source,settings,{
      maxRegions:8,maxTerritories:7});
    return {territories:plan.territories,stats:plan.territoryStats,
      void:plan.protectedVoids[0]};
  });
  assert(territoriesSynthetic.stats.painted>0,
    'Real recorded φ cells with source marks should become painted territories');
  assert(territoriesSynthetic.stats.framed>0,
    'Enclosed regions should preserve intentional framed/empty cells');
  assert(territoriesSynthetic.territories.every(t=>
    !AABB(t.box,territoriesSynthetic.void)),
    'No semantic territory may touch an explicitly reserved void');
  function AABB(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&
    a.y<b.y+b.h&&a.y+a.h>b.y}
  assert(territoriesSynthetic.territories.every(t=>t.sources.length&&
    t.contour.length===4),
    'Semantic territories require source lineage and actual φ-cell geometry');
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
        const fallback=A.renderInterpretedV5E(faithful,settings,size,
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
        const v5d=document.createElement('canvas');
        const currentPlan=A.planCompositionV5;
        try{
          // True frozen V5d source-guide planner and its unchanged adapter.
          A.planCompositionV5=(ss,oo)=>A.compositionV5dFromSource(
            A.captureCompositionV5(ss,oo),ss,oo);
          A.renderInterpretedV5D(v5d,settings,size,{...opts,material});
        }finally{A.planCompositionV5=currentPlan}
        const output=A.renderInterpretedV5E(interpreted,settings,size,
          {...opts,material});
        const repeatOut=A.renderInterpretedV5E(repeat,settings,size,
          {...opts,material});
        const equal=interpreted.toDataURL()===repeat.toDataURL(),
              changed=interpreted.toDataURL()!==faithful.toDataURL(),
              image=interpreted.getContext('2d').getImageData(0,0,
                interpreted.width,interpreted.height).data,
              reference=faithful.getContext('2d').getImageData(0,0,
                faithful.width,faithful.height).data;
        const referenceV5d=v5d.getContext('2d').getImageData(0,0,
          v5d.width,v5d.height).data;
        let changedPixels=0,changedFromV5d=0;
        for(let j=0;j<image.length;j+=4){
          if(Math.abs(image[j]-reference[j])+
            Math.abs(image[j+1]-reference[j+1])+
            Math.abs(image[j+2]-reference[j+2])>18)changedPixels++;
          if(Math.abs(image[j]-referenceV5d[j])+
            Math.abs(image[j+1]-referenceV5d[j+1])+
            Math.abs(image[j+2]-referenceV5d[j+2])>18)changedFromV5d++;
        }
        renders[material]={preserved,equal,changed,changedPixels,
          changedFromV5d,
          stats:output,v5d:v5d.toDataURL('image/png').split(',')[1],
          faithful:faithful.toDataURL('image/png').split(',')[1],
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
    if(entry.mode!=='rects'){
      assert(payload.plan.colourFields.length>0,
        'A nonrectilinear guide should create actual two-dimensional colour fields');
      assert(payload.plan.colourFields.every(f=>
        f.contour.length>=6&&f.sources.length>0&&f.area>=9000),
        'New fields must be large source-attached areas, not thicker paths');
      assert(payload.plan.colourFields.every(f=>
        !payload.plan.protectedVoids.some(v=>AABB(f.box,v))),
        'Broad colour fields must not span reserved source voids');
    }else assert.equal(payload.plan.colourFields.length,0,
      'V5e must not recolour the already solved phi-cell layout');
        if(entry.mode==='organic'){
      assert.equal(payload.plan.guideSemantics,'organic');
      assert(payload.plan.guideStats.branches>0,
        'Organic source guide must create real branch corridors');
      assert(payload.plan.territories.some(t=>t.kind==='organic-branch'&&
        t.axis.length>=3&&t.sources.length>0));
    }
    if(entry.mode==='spiral'){
      assert.equal(payload.plan.guideSemantics,'spiral');
      assert(payload.plan.guideStats.ribbons>0,
        'Trajectory source guide must create real curve ribbons');
      assert(payload.plan.territories.some(t=>t.kind==='trajectory-ribbon'&&
        t.axis.length>=4&&t.sources.length>0));
    }
    if(entry.mode==='geometric'){
      assert.equal(payload.plan.guideSemantics,'constructed');
      assert(payload.plan.guideStats.constructed>0,
        'Constructed source guide must create actual focal forms');
      assert(payload.plan.territories.some(t=>t.kind==='constructed-focal-form'&&
        t.sources.length>0));
    }
        if(entry.mode==='rects'){
      assert.equal(payload.plan.sourceGuideKind,'rects');
      assert(payload.plan.territoryStats.painted>0,
        'Rectilinear engine must have at least one source-supported coloured plane');
      assert(payload.plan.territoryStats.framed>0,
        'Do not fill every framed rectangle');
      assert(payload.plan.territories.every(t=>
        t.sources.length>0&&t.contour.length===4),
        'Each territory must have original source lineage and outline');
      assert(payload.plan.territories.every(t=>
        !payload.plan.protectedVoids.some(v=>
          t.box.x<v.x+v.w&&t.box.x+t.box.w>v.x&&
          t.box.y<v.y+v.h&&t.box.y+t.box.h>v.y)),
        'Planned territory intersects an original reserved void');
    } else {
      assert(payload.plan.territories.every(t=>
        t.sources.length>0&&t.contour.length>=4&&
        !payload.plan.protectedVoids.some(v=>
          AABB(t.box,v)&&t.role==='painted')),
        'Guide territories require source provenance and protected gaps');
    }
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
      if(entry.mode==='rects')assert.equal(out.changedFromV5d,0,
        'V5e must preserve V5c/V5d phi-rectangle territory output identically');
      else assert(out.changedFromV5d>(material==='oil'?2500:900),
        material+' V5e has not added a substantial new two-dimensional field');
      assert.equal(out.stats.plan.regions.length,payload.plan.regions.length);
      assert.deepEqual(out.stats.plan.territories,payload.plan.territories,
        'Material must not change semantic cell roles or boundary contours');
      assert.deepEqual(out.stats.plan.regions,payload.plan.regions,
        'Material changed shared plan');
      const prefix=entry.mode+'-'+entry.orientation+'-'+material;
      for(const mode of ['faithful','v5d','interpreted']){
        const bytes=Buffer.from(out[mode],'base64');
        assert(bytes.length>14000,material+' missing actual pixels');
        await writeFile(path.join(folder,prefix+'-'+mode+'.png'),bytes);
      }
      console.log('V5e '+entry.mode+' '+material+
        ' guide '+payload.plan.guideSemantics+
        ' plan '+JSON.stringify(payload.plan.guideStats)+
        ' roles '+JSON.stringify(payload.plan.territoryStats)+
        ' versusV5d '+out.changedFromV5d+
        ' versusFaithful '+out.changedPixels+
        ' paint '+JSON.stringify(out.stats.work));
    }
    results.push({
      seed:payload.settings.seed,mode:entry.mode,
      orientation:entry.orientation,
      plan:payload.plan,
      materials:Object.fromEntries(['oil','tissue'].map(m=>[m,{
        faithfulByteIdentical:payload.renders[m].preserved,
        repeatByteIdentical:payload.renders[m].equal,
        changedPixels:payload.renders[m].changedPixels,
        changedFromV5d:payload.renders[m].changedFromV5d,
        work:payload.renders[m].stats.work,
        renderMs:payload.renders[m].stats.renderMs
      }]))
    });
  }
  // 6 columns: Oil faithful/V5d/V5e and Tissue faithful/V5d/V5e.
  const cards=results.flatMap((a)=>['oil','tissue'].flatMap(m=>
    ['faithful','v5d','interpreted'].map(type=>({
      label:a.mode.toUpperCase()+' · '+m+' · '+type,
      filename:a.mode+'-'+a.orientation+'-'+m+'-'+type+'.png'
    }))));
  // Actual images from the server-local renderer; the test's PNGs are
  // written before loading the sheet. No introductory modal screenshots.
  const sheet=await page.evaluate(async ({cards,folder})=>{
    const w=1440,h=1122,out=document.createElement('canvas');
    out.width=w;out.height=h;const g=out.getContext('2d');
    g.fillStyle='#e9e3db';g.fillRect(0,0,w,h);
    for(let i=0;i<cards.length;i++){
      const item=cards[i],im=new Image();
      im.src='/'+folder+'/'+item.filename;
      await new Promise((ok,bad)=>{im.onload=ok;im.onerror=bad});
      const x=(i%6)*240,y=Math.floor(i/6)*280;
      g.fillStyle='#f5f0e6';g.fillRect(x+6,y+5,228,245);
      const scale=Math.min(223/im.width,239/im.height);
      g.drawImage(im,x+120-im.width*scale/2,
        y+126-im.height*scale/2,im.width*scale,im.height*scale);
      g.fillStyle='#26231f';g.font='12px sans-serif';
      g.fillText(item.label,x+7,y+264);
    }
    return out.toDataURL('image/jpeg',.92).split(',')[1];
  },{cards,folder});
  await writeFile(folder+'/v5e-faithful-v5d-v5e-oil-tissue.jpg',
    Buffer.from(sheet,'base64'));
  await writeFile(folder+'/v5-manifest.json',JSON.stringify({
    version:'V5e broad source-colour fields versus frozen V5d guide interpretation',
    pipeline:'same source geometry -> one material-neutral plan -> two material adapters',
    published:false,sourceRenderedBy:'ALGO/ART procedural engines',
    cases:results
  },null,2));
  assert.deepEqual(faults,[],'Browser exceptions');
  console.log('PASS V5e: broad field layers create significant source-derived coverage without changing faithful/rectangular behaviour');
}finally{await browser.close()}
