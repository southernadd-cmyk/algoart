// The shared global navigation must use the existing uppercase marker font
// without clipping, overlap or horizontal escape on mobile and desktop.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const widths=[320,360,375,390,430,600,768,850,1024,1440];
const paths=['','gallery/','about/'];
try{
 for(const path of paths){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
   await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded',timeout:90000});
   await page.evaluate(async()=>{await document.fonts.load('15px "AlgoArt Marker"');await document.fonts.ready;});
   for(const width of widths){
    await page.setViewportSize({width,height:900});
    const result=await page.evaluate(()=>{
     const header=document.querySelector('body .algo-global-header');
     const nav=header?.querySelector('.algo-site-nav');
     const brand=header?.querySelector('.algo-global-brand');
     if(!header||!nav||!brand)return {error:'missing shared header'};
     const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
     const links=[...nav.querySelectorAll('a[data-algo-nav]')].map(a=>{
      const range=document.createRange();range.selectNodeContents(a);
      return {text:a.textContent,href:a.getAttribute('href'),rect:rect(a),
        naturalWidth:range.getBoundingClientRect().width,
        font:getComputedStyle(a).fontFamily,
        transform:getComputedStyle(a).textTransform,
        svgCount:a.querySelectorAll('svg').length};
     });
     return {viewport:innerWidth,header:rect(header),nav:rect(nav),brand:rect(brand),
       links,fontReady:document.fonts.check('15px "AlgoArt Marker"')};
    });
    assert(!result.error,JSON.stringify({path,width,result}));
    assert.equal(result.links.length,3,path+' must have three nav links');
    assert(result.fontReady,path+' shared marker font not loaded');
    for(const l of result.links){
     assert(l.font.includes('AlgoArt Marker'),path+' uses wrong font at '+width+': '+l.font);
     assert.equal(l.svgCount,0,path+' still uses lowercase SVG alphabet');
     assert.equal(l.text,l.text.toUpperCase(),path+' link did not become uppercase');
     assert(l.href,path+' empty nav href');
     assert(l.rect.right<=result.viewport+1,JSON.stringify({path,width,why:'nav link outside viewport',l,result}));
     assert(l.rect.left>=-1,JSON.stringify({path,width,why:'nav link outside left edge',l,result}));
     assert(l.naturalWidth<=l.rect.width+1,JSON.stringify({path,width,why:'text clipped',l,result}));
    }
    const intersectsY=(a,b)=>a.top<b.bottom-2&&b.top<a.bottom-2;
    for(let i=1;i<result.links.length;i++){
     const prev=result.links[i-1].rect,cur=result.links[i].rect;
     assert(cur.left>=prev.right-1,JSON.stringify({path,width,why:'nav links overlap',result}));
    }
    if(intersectsY(result.brand,result.nav)){
     assert(result.brand.right<=result.nav.left+1,
       JSON.stringify({path,width,why:'nav overlaps wordmark',result}));
    }
    assert(result.nav.right<=result.viewport+1,JSON.stringify({path,width,why:'nav escapes viewport',result}));
    console.log('HEADER_NAV '+JSON.stringify({path:path||'editor',width,
      font:result.links[0].font,navWidth:Math.round(result.nav.width),brandRight:Math.round(result.brand.right),
      navLeft:Math.round(result.nav.left),right:Math.round(result.nav.right)}));
   }
  }finally{await page.close()}
 }
}finally{await browser.close()}
console.log('PASS uppercase marker navigation on editor/gallery/about at all mobile and desktop widths');
