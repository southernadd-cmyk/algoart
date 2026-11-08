import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {OIL_V8_CUTOVER,oilVersionForDate,verifyReleasedOilV8} from '../automation/oil-edition.mjs';
import {validateOilItem} from '../automation/oil-slot.mjs';
import {makeCaptions} from '../automation/captions.mjs';
for(const day of ['2026-10-15','2026-10-25','2026-10-26','2026-10-30','2026-10-31',OIL_V8_CUTOVER].filter(Boolean))for(const orientation of ['landscape','portrait']){
 const version=oilVersionForDate(day),seed='OIL-EDITION-TEST';
 const url=new URL('https://southernadd-cmyk.github.io/algoart/');
 for(const [k,v] of Object.entries({v:'9',material:version,seed,mode:'organic',pal:'golden',...(orientation==='portrait'?{fmt:'portrait'}:{})}))url.searchParams.set(k,v);
 const item={id:day+'-'+(orientation==='portrait'?'OP':'OL')+'01',material:'oil',rendererVersion:9,seed,mode:'organic',orientation,shareUrl:url.href,series:'Growth Systems',settings:{orientation,palette:'golden',phiStrength:91}};
 validateOilItem(item,day,orientation);
 // The historical renderer revision belongs in the reproducible artwork URL,
 // never in the public-facing name of the Oil material.
 const copy=makeCaptions(item);
 for(const platform of ['instagram','threads','bluesky']){
   assert.match(copy[platform],/\/ OIL(?:\n|$)/,platform+' must display Oil');
   assert.doesNotMatch(copy[platform],/\bOIL(?: PAINT)? V\d+\b/i,platform+' must not display a renderer revision');
 }
 assert.equal(new URL(item.shareUrl).searchParams.get('material'),version,
   'The original Oil revision must remain in the reproducible link');
 const bad=new URL(url);bad.searchParams.set('material',version==='oil-v6'?'oil-v5':'oil-v6');
 assert.throws(()=>validateOilItem({...item,shareUrl:bad.href},day,orientation),/does not reproduce/);
}
const exportCode=readFileSync('js/export.js','utf8');
const releaseCode=readFileSync('js/oil-release.js','utf8');
for(const version of ['v1','v2','v3','v4','v5','v6','v7','v8']){
 let called=null,received=null;
 const A={};for(let n=1;n<=8;n++)A['renderOilPaintV'+n]=(canvas,settings,scale,reveal,options)=>{
  called='v'+n;received=settings;
  if(n===8)verifyReleasedOilV8({version:'oil-paint-v8',options});
 };
 const doc={createElement:()=>({width:1,height:1,toBlob:callback=>callback({size:32})})};
 vm.runInNewContext(releaseCode+exportCode,{window:{AlgoArt:A},document:doc});
 const settings={seed:'PNG-DISPATCH',mode:'rects',orientation:'portrait',oilPaintRender:true,oilPaintRevision:version},before=JSON.stringify(settings);
 const result=await A.preparePNG(settings,1);
 assert.equal(called,version);assert(result.filename.includes('-oil-paint-'+version+'-1x.png'));
 assert(!('oilPaintRender' in received));assert(!('oilPaintRevision' in received));assert.equal(JSON.stringify(settings),before);
}
for(const path of ['index.html','test/index.html','about/step-by-step/index.html']){
 const html=readFileSync(path,'utf8');
 assert(html.includes('oil-pigment.js?v=20261025-oil-v5-release'));
 assert(html.includes('oil-paint-v5.js?v=20261025-oil-v5-release'));
 assert(html.indexOf('cpu-material-versions.js')<html.indexOf('oil-paint-v5.js'));
 assert(html.indexOf('oil-brush-v8.js')<html.indexOf('oil-paint-v8.js'));
 assert(html.indexOf('oil-paint-v8.js')<html.indexOf('oil-release.js'));
 for(const filename of ['oil-v1-core-a','oil-v1-core-c','oil-paint-v1','oil-brush-v3'])assert(html.includes(filename+'.js?v=20261025-oil-v5-release'),'Returning browsers get V5-compatible hooks: '+path+' '+filename);
}
console.log('PASS Oil release: date validation/captions, PNG dispatch V1–V8, immutable export settings and script order.');

