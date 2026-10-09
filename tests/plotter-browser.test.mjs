import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PLOTTER_LIMITS,PIXEL_THRESHOLDS} from './plotter-metrics.mjs';
const engine=process.env.ARCHIVE_BROWSER||'chromium';
const browser=await {chromium,firefox,webkit}[engine].launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1200}});
const output=path.resolve('plotter-check-results',engine);
await fs.mkdir(output,{recursive:true});
await page.addInitScript(()=>localStorage.setItem('algoart-intro-seen','1'));
await page.goto((process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/')+'?v=7&seed=PLOTTER-TEST&mode=field',{waitUntil:'networkidle'});
const cases=[];
const report={browser:engine,browserVersion:browser.version(),
  playwrightVersion:createRequire(import.meta.url)('playwright/package.json').version,
  limits:PLOTTER_LIMITS,pixelThresholds:PIXEL_THRESHOLDS,samples:cases,regressionProbes:[]};
console.log('Plotter runtime '+JSON.stringify({browser:engine,version:report.browserVersion,
  playwright:report.playwrightVersion,limits:report.limits,pixelThresholds:report.pixelThresholds}));
try{
  const samples=[];
  for(const orientation of ['landscape','portrait'])for(const mode of ['field','spiral','rects','burst','network','organic','geometric','scribble'])for(const pen of ['felt','dry','highlighter']){
    samples.push({mode,orientation,pen,version:7});
  }
  for(let version=1;version<=6;version++)samples.push({mode:'spiral',orientation:'landscape',pen:'felt',version});
  const archive=JSON.parse(await fs.readFile(new URL('../gallery/2026-10-09/meta.json',import.meta.url),'utf8'));
  const portraitScribble=archive.entries.find(e=>e.mode==='scribble'&&e.orientation==='portrait');
  samples.push({mode:portraitScribble.mode,orientation:portraitScribble.orientation,pen:portraitScribble.settings.pen,
    version:portraitScribble.rendererVersion,settings:portraitScribble.settings,id:portraitScribble.id});
  for(const [day,id] of [['2026-10-06','2026-10-06-06'],['2026-10-07','2026-10-07-05'],['2026-10-05','2026-10-05-03']]){
    const archived=JSON.parse(await fs.readFile(new URL('../gallery/'+day+'/meta.json',import.meta.url),'utf8'));
    const entry=archived.entries.find(e=>e.id===id);
    samples.push({mode:entry.mode,orientation:entry.orientation||'landscape',pen:entry.settings.pen,
      version:entry.rendererVersion,settings:entry.settings,id:entry.id});
  }
  for(const sample of samples){
    const result=await page.evaluate(async sample=>{
      const {compareRGB,withinLimits,PLOTTER_LIMITS}=await import('/tests/plotter-metrics.mjs');
      const A=window.AlgoArt;
      const s=sample.settings?{...A.readSettings(),...sample.settings,orientation:sample.orientation}:
        {...A.readSettings(),...sample,seed:'PLOTTER-FIDELITY-'+sample.mode,elements:36,recursion:5,negativeSpace:30,grain:18,overdraw:3,dryness:sample.pen==='dry'?78:12,opacity:78};
      delete s.version;
      A.rendererVersion=sample.version;
      const canvas=document.createElement('canvas');
      A.render(canvas,s,1,false);
      const beforeVersion=A.rendererVersion,beforeMeta=A.lastRenderMeta;
      const original=A.createPlotterSVG(s,{paper:'A4',margin:10,optimize:false});
      const optimized=A.createPlotterSVG(s,{paper:'A4',margin:10,optimize:true});
      const grouped=A.createPlotterSVG(s,{paper:'A4',margin:10,grouping:'pens',optimize:false});
      const groupedOptimized=A.createPlotterSVG(s,{paper:'A4',margin:10,grouping:'pens',optimize:true});
      if(A.rendererVersion!==beforeVersion||A.lastRenderMeta!==beforeMeta)throw Error('Export changed artwork state');
      if(optimized.metadata.penTravelAfterMm>original.metadata.penTravelBeforeMm+1e-7)throw Error('Pen travel increased');
      const parser=new DOMParser(),file=parser.parseFromString(optimized.svg,'image/svg+xml');
      if(file.querySelector('parsererror'))throw Error('Malformed SVG');
      const layers=Array.from(file.documentElement.children).filter(e=>e.localName==='g');
      if(layers.length!==optimized.metadata.colourRuns)throw Error('Pen layers are not top-level');
      const inkscape='http://www.inkscape.org/namespaces/inkscape';
      if(layers.some(g=>g.getAttributeNS(inkscape,'groupmode')!=='layer'))throw Error('Invalid Inkscape layer');
      layers.forEach((g,i)=>{
        const name=g.getAttributeNS(inkscape,'label');
        if(name.startsWith('!')!==(i>0)||Number(name.replace(/^!/, '').match(/^\d+/)[0])!==i+1)throw Error('Faithful pen-change pause lost the run number');
      });
      if(optimized.metadata.forcedPauses!==Math.max(0,layers.length-1))throw Error('Faithful pause count disagrees');
      const paths=Array.from(file.querySelectorAll('path'));
      if(paths.some(p=>p.hasAttribute('stroke-dasharray')))throw Error('Dry gaps were left as a dash style');
      if(paths.length!==optimized.metadata.svgPaths)throw Error('Path count disagrees');
      const groupedFile=parser.parseFromString(grouped.svg,'image/svg+xml');
      if(groupedFile.querySelector('parsererror'))throw Error('Malformed grouped SVG');
      const penLayers=Array.from(groupedFile.documentElement.children).filter(e=>e.localName==='g');
      const colours=Array.from(new Set(paths.map(p=>p.getAttribute('stroke')))).sort((a,b)=>A.plotterGeometry.luminance(b)-A.plotterGeometry.luminance(a));
      if(penLayers.length!==colours.length||grouped.metadata.penLayers!==colours.length)throw Error('Grouping did not produce one layer per pen');
      if(grouped.metadata.colourRuns!==original.metadata.colourRuns)throw Error('Grouping lost original run count');
      if(grouped.metadata.penChanges!==Math.max(0,colours.length-1))throw Error('Incorrect grouped pen-change count');
      if(grouped.metadata.paths!==original.metadata.paths||grouped.metadata.svgPaths!==original.metadata.svgPaths)throw Error('Grouping lost source paths');
      if(grouped.metadata.pathOrder!=='preserved-within-pen')throw Error('Grouped metadata promises original global order');
      if(groupedOptimized.metadata.pathOrder!=='reordered-within-pen'||groupedOptimized.metadata.penOrder!=='light-to-dark')throw Error('Grouped route metadata disagrees');
      if(groupedOptimized.metadata.forcedPauses!==0)throw Error('Grouped layer-mode plots unexpectedly pause');
      const faithfulFile=parser.parseFromString(original.svg,'image/svg+xml');
      const faithfulPaths=Array.from(faithfulFile.querySelectorAll('path'));
      penLayers.forEach((g,i)=>{
        if(g.getAttributeNS(inkscape,'groupmode')!=='layer'||g.getAttributeNS(inkscape,'label')!==(i+1)+' · '+colours[i])throw Error('Pen layer is not AxiDraw-addressable');
        const expected=faithfulPaths.filter(p=>p.getAttribute('stroke')===colours[i]).map(p=>p.outerHTML);
        const actual=Array.from(g.children).map(p=>p.outerHTML);
        if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Grouping changed path geometry, style or per-pen order');
      });
      const routedFile=parser.parseFromString(groupedOptimized.svg,'image/svg+xml');
      const routedLayers=Array.from(routedFile.documentElement.children).filter(e=>e.localName==='g');
      // Normalise each subpath's direction and sort compound-pass fragments,
      // then compare multisets of complete source passes, including styles.
      // A missing/duplicated stroke or a split dry-marker pass must fail.
      const signature=p=>{
        const commands=A.plotterGeometry.commands(p.getAttribute('d')),pieces=[];
        commands.forEach(c=>{if(c.type==='M')pieces.push([]);pieces[pieces.length-1].push(c)});
        const shapes=pieces.map(part=>[JSON.stringify(part),JSON.stringify(A.plotterGeometry.reversed(part))].sort()[0]).sort();
        const styles=Array.from(p.attributes).filter(a=>a.name!=='d').map(a=>[a.name,a.value]).sort();
        return JSON.stringify([styles,shapes]);
      };
      routedLayers.forEach((g,i)=>{
        if(g.getAttributeNS(inkscape,'label')!==(i+1)+' · '+colours[i])throw Error('Routing changed light-to-dark pen numbering');
        const expected=Array.from(penLayers[i].children,signature).sort();
        const actual=Array.from(g.children,signature).sort();
        if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Routing changed source geometry/style or split a compound pass');
      });
      if(groupedOptimized.metadata.penTravelAfterMm>grouped.metadata.penTravelBeforeMm+1e-7)throw Error('Grouped direction optimisation increased travel');
      const n=optimized.metadata,scale=Math.min((n.pageMm[0]-20)/canvas.width,(n.pageMm[1]-20)/canvas.height);
      const x=(n.pageMm[0]-canvas.width*scale)/2,y=(n.pageMm[1]-canvas.height*scale)/2;
      const home={x:-x/scale,y:-y/scale};
      let fixedGroupedTravel=0;
      penLayers.forEach(g=>{
        const strokes=[];
        Array.from(g.children).forEach(p=>{
          let stroke;
          A.plotterGeometry.commands(p.getAttribute('d')).forEach(c=>{
            if(c.type==='M'){stroke={commands:[]};strokes.push(stroke)}
            stroke.commands.push(c);
          });
        });
        fixedGroupedTravel+=A.plotterGeometry.travel(A.plotterGeometry.optimize(strokes,home),home)*scale;
      });
      if(groupedOptimized.metadata.penTravelAfterMm>fixedGroupedTravel+1e-7)throw Error('Grouped routing regressed against direction-only travel');
      // These real artworks contain long source passes which must stay intact for correct
      // opacity. A 40% pen-up saving is not guaranteed by nearest-neighbour routing;
      // assert a useful improvement over the exact fixed-order direction baseline.
      if(['2026-10-06-06','2026-10-07-05'].includes(sample.id)&&groupedOptimized.metadata.penTravelAfterMm>fixedGroupedTravel*.9)throw Error('Reported scattered artwork did not save at least 10% of pen-up travel');
      if(sample.id==='2026-10-05-03'&&colours[0]!=='#c7c7c7')throw Error('Archived grey Scribble does not start with the lightest grey');
      async function raster(svg){
        const doc=parser.parseFromString(svg,'image/svg+xml');
        doc.documentElement.setAttribute('width',String(canvas.width));
        doc.documentElement.setAttribute('height',String(canvas.height));
        doc.documentElement.setAttribute('viewBox',[x,y,canvas.width*scale,canvas.height*scale].join(' '));
        const img=new Image();
        img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(doc))));
        await img.decode();
        const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
        c.getContext('2d').drawImage(img,0,0);
        return c;
      }
      const baseline=await raster(original.preview),render=await raster(optimized.preview);
      // Build an independent grouped reference by gathering the faithful SVG's
      // existing paths. Its pixels need not match the original overlap order.
      const reference=parser.parseFromString(original.preview,'image/svg+xml');
      const oldLayers=Array.from(reference.documentElement.children).filter(e=>e.getAttributeNS(inkscape,'groupmode')==='layer');
      const referencePaths=oldLayers.flatMap(g=>Array.from(g.children));
      oldLayers.forEach(g=>g.remove());
      colours.forEach(colour=>{
        const layer=oldLayers.find(g=>g.getAttribute('data-pen-colour')===colour).cloneNode(false);
        referencePaths.filter(p=>p.getAttribute('stroke')===colour).forEach(p=>layer.appendChild(p));
        reference.documentElement.appendChild(layer);
      });
      const groupedBaseline=await raster(grouped.preview),groupedRender=await raster(groupedOptimized.preview);
      const groupedReference=await raster(new XMLSerializer().serializeToString(reference));
      function difference(a,b){
        const pa=a.getContext('2d').getImageData(0,0,a.width,a.height).data,pb=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
        const heat=document.createElement('canvas');heat.width=a.width;heat.height=a.height;
        const ctx=heat.getContext('2d'),data=ctx.createImageData(a.width,a.height);
        const metrics=compareRGB(pa,pb,data.data);
        ctx.putImageData(data,0,0);
        return{...metrics,diff:heat.toDataURL()};
      }
      const fidelity=difference(canvas,render),direction=difference(baseline,render);
      const grouping=difference(groupedReference,groupedBaseline),groupedDirection=difference(groupedBaseline,groupedRender);
      const metrics=({mean,changed,severe})=>({mean,changed,severe});
      return{metadata:n,groupedMetadata:groupedOptimized.metadata,fixedGroupedTravel,fidelity:metrics(fidelity),direction:metrics(direction),
        grouping:metrics(grouping),groupedDirection:metrics(groupedDirection),
        passed:withinLimits(fidelity,PLOTTER_LIMITS.fidelity)&&withinLimits(direction,PLOTTER_LIMITS.direction)&&
          withinLimits(grouping,PLOTTER_LIMITS.direction)&&withinLimits(groupedDirection,PLOTTER_LIMITS.direction),
        canvas:canvas.toDataURL(),render:render.toDataURL(),diff:fidelity.diff,svg:optimized.svg,
        grouped:groupedRender.toDataURL(),groupedDiff:groupedDirection.diff,groupedSVG:groupedOptimized.svg};
    },sample);
    const label=sample.id||[sample.version,sample.mode,sample.orientation,sample.pen].join('-');
    cases.push({sample,passed:result.passed,metadata:result.metadata,groupedMetadata:result.groupedMetadata,fixedGroupedTravel:result.fixedGroupedTravel,
      fidelity:result.fidelity,direction:result.direction,grouping:result.grouping,groupedDirection:result.groupedDirection});
    console.log((result.passed?'PASS ':'FAIL ')+label+' '+JSON.stringify({fidelity:result.fidelity,direction:result.direction,
      grouping:result.grouping,groupedDirection:result.groupedDirection}));
    if(sample.id)console.log('Archived plotter route '+JSON.stringify({id:sample.id,colourRuns:result.metadata.colourRuns,
      colours:result.groupedMetadata.penColours,faithfulChanges:result.metadata.penChanges,groupedChanges:result.groupedMetadata.penChanges,
      faithfulMm:result.metadata.penTravelAfterMm,previousGroupedMm:result.fixedGroupedTravel,groupedMm:result.groupedMetadata.penTravelAfterMm}));
    if(!result.passed){
      for(const key of ['canvas','render','diff','grouped','groupedDiff'])await fs.writeFile(path.join(output,label+'-'+key+'.png'),Buffer.from(result[key].split(',')[1],'base64'));
      await fs.writeFile(path.join(output,label+'.svg'),result.svg);
      await fs.writeFile(path.join(output,label+'-grouped.svg'),result.groupedSVG);
    }
  }
  // Each deliberate SVG defect affects only 0.15% of the image: it must
  // pass the old mean/moderate-tail checks and fail the new severe tail.
  report.regressionProbes=await page.evaluate(async()=>{
    const {compareRGB,withinLimits,PLOTTER_LIMITS}=await import('/tests/plotter-metrics.mjs');
    const width=1400,height=1000;
    const root='<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000" style="isolation:isolate">';
    const paper='<rect width="1400" height="1000" fill="white"/>';
    const line='<path d="M100 100 L205 100" fill="none" stroke="black" stroke-width="20"/>';
    const blue='<rect x="100" y="100" width="50" height="42" fill="#0000ff"/>';
    const red='<rect x="100" y="100" width="50" height="42" fill="#ff0000" fill-opacity=".8" style="mix-blend-mode:multiply"/>';
    const pixelData=c=>c.getContext('2d').getImageData(0,0,width,height).data;
    async function raster(svg){
      const img=new Image();
      img.src='data:image/svg+xml;base64,'+btoa(svg);
      await img.decode();
      const c=document.createElement('canvas');c.width=width;c.height=height;
      c.getContext('2d').drawImage(img,0,0);
      return c;
    }
    const result=[];
    for(const name of ['missing-stroke','missing-multiply-blend']){
      const reference=document.createElement('canvas');reference.width=width;reference.height=height;
      const ctx=reference.getContext('2d');
      ctx.fillStyle='white';ctx.fillRect(0,0,width,height);
      let intact,broken;
      if(name==='missing-stroke'){
        ctx.strokeStyle='black';ctx.lineWidth=20;ctx.beginPath();
        ctx.moveTo(100,100);ctx.lineTo(205,100);ctx.stroke();
        intact=root+paper+line+'</svg>';
        broken=root+paper+'</svg>';
      }else{
        ctx.fillStyle='#0000ff';ctx.fillRect(100,100,50,42);
        ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.8;
        ctx.fillStyle='#ff0000';ctx.fillRect(100,100,50,42);
        intact=root+paper+blue+red+'</svg>';
        broken=intact.replace(' style="mix-blend-mode:multiply"','');
      }
      const good=compareRGB(pixelData(reference),pixelData(await raster(intact)));
      const defect=compareRGB(pixelData(reference),pixelData(await raster(broken)));
      const meanAndModeratePass=withinLimits(defect,{
        mean:PLOTTER_LIMITS.fidelity.mean,changed:PLOTTER_LIMITS.fidelity.changed});
      const rejected=!withinLimits(defect,PLOTTER_LIMITS.fidelity);
      const row={name,control:good,defect,meanAndModeratePass,rejected};
      result.push(row);
      if(!withinLimits(good,PLOTTER_LIMITS.fidelity)||!meanAndModeratePass||!rejected){
        throw Error('Local regression guard failed: '+JSON.stringify(row));
      }
    }
    return result;
  });
  for(const probe of report.regressionProbes)console.log('Local defect probe '+JSON.stringify(probe));
  // End-to-end UI: page options cannot upgrade a legacy renderer or mutate art.
  await page.goto((process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/')+'?v=6&seed=PLOTTER-UI&mode=organic',{waitUntil:'networkidle'});
  await page.locator('[data-tab="export"]').click();
  if(await page.locator('#plotterGrouping').inputValue()!=='runs')throw Error('Faithful mode is not the default');
  const originalURL=page.url();
  await page.locator('#plotterPaper').selectOption('A3');
  await page.locator('#plotterMargin').fill('15');
  await page.locator('#plotterMargin').dispatchEvent('change');
  await page.locator('#previewPlotter').click();
  await page.locator('#plotterPreviewImage').evaluate(img=>img.decode());
  await page.locator('#plotterGrouping').selectOption('pens');
  if(await page.locator('#plotterPreview').isVisible())throw Error('Grouping left a stale faithful preview');
  if(!(await page.locator('#plotterGroupingNote').textContent()).includes('which colour sits on top'))throw Error('Grouping overlap warning missing');
  if(!(await page.locator('#plotterGroupingNote').textContent()).includes('light to dark')||!(await page.locator('#plotterOptimizeLabel').textContent()).includes('reordering'))throw Error('Grouped route UI still promises fixed source order');
  await page.locator('#previewPlotter').click();
  await page.locator('#plotterPreviewImage').evaluate(img=>img.decode());
  if(!(await page.locator('#plotterSummary').textContent()).includes('pen changes'))throw Error('Pen changes missing from summary');
  if(page.url()!==originalURL)throw Error('Plotter options changed artwork URL');
  if(await page.evaluate(()=>window.AlgoArt.rendererVersion)!==6)throw Error('Plotter export upgraded a legacy drawing');
  const download=page.waitForEvent('download');
  await page.locator('#savePlotter').click();
  const file=await download;
  if(!file.suggestedFilename().endsWith('-plotter.svg'))throw Error('Plotter download missing');
  const downloaded=await fs.readFile(await file.path(),'utf8');
  await page.evaluate(svg=>{
    const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
    const metadata=JSON.parse(doc.querySelector('metadata').textContent);
    if(metadata.layerGrouping!=='pens'||metadata.penLayers!==metadata.penColours.length)throw Error('Download ignored selected grouping');
  },downloaded);
  await page.locator('#plotterPreviewImage').evaluate(img=>img.decode());
  await page.screenshot({path:path.join(output,'grouped-ui.png')});
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile preview overflows viewport');
  await page.screenshot({path:path.join(output,'grouped-ui-mobile.png')});
  await page.locator('#plotterGrouping').selectOption('runs');
  if(await page.locator('#plotterPreview').isVisible())throw Error('Returning to faithful mode left a stale grouped preview');
  if(!(await page.locator('#plotterGroupingNote').textContent()).includes('preserve overlap order'))throw Error('Faithful mode note was not restored');
  if(!(await page.locator('#plotterGroupingNote').textContent()).includes('AxiDraw pauses'))throw Error('Faithful pen-change instruction missing');
  if(!(await page.locator('#plotterOptimizeLabel').textContent()).includes('without changing stroke order'))throw Error('Faithful route instruction missing');
}finally{
  await browser.close();
  report.maxima={};
  for(const kind of ['fidelity','direction','grouping','groupedDirection'])report.maxima[kind]=Object.fromEntries(
    ['mean','changed','severe'].map(key=>[key,Math.max(0,...cases.map(row=>row[kind][key]))]));
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
}
const failures=cases.filter(r=>!r.passed);
console.log('Plotter / '+engine+': '+cases.length+' visual cases, '+failures.length+' failures.');
console.log('Plotter maxima '+JSON.stringify(report.maxima));
if(failures.length)process.exitCode=1;
