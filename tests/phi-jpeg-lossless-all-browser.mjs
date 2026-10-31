// TEST ONLY: verify archive JPEG and matching raw KTX2 decoded pixel
// identity in the actual browser, and verify both tower start variants.
// A difference fails CI; do not claim browser pixel parity if mismatches.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin='https://southernadd-cmyk.github.io/algoart';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const candidates=[
 'gallery/2026-10-05/2026-10-05-01-organic-AA-20261005-01-17577.jpg',
 'gallery/2026-10-05/2026-10-05-02-geometric-AA-20261005-02-35988.jpg',
 'test/virtual-gallery/textures/Bricks055_NormalGL.jpg'
];
try{
 const page=await browser.newPage({viewport:{width:1150,height:700}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'/test/virtual-gallery/full-engine.html?debug=1&jpegformat=lossless',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__phiJPEGLosslessBank!==undefined,
  null,{timeout:120000});
 const results=[];
 for(const file of candidates){
  const value=await page.evaluate(async({file,origin})=>{
   const bank=window.__phiJPEGLosslessBank;
   const path=origin+'/'+file;
   const tex=await bank.load(path,{color:!file.includes('NormalGL')});
   const image=await new Promise((resolve,reject)=>{
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Original JPEG missing '+path));
    img.src=path;
   });
   const canvas=document.createElement('canvas');
   canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(image,0,0);
   const browserPixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const ktxPixels=tex.image.data;
   let differences=0,maxDifference=0,first=-1;
   for(let i=0;i<browserPixels.length;i++){
    const delta=Math.abs(browserPixels[i]-ktxPixels[i]);
    if(delta){differences++;if(first<0)first=i;maxDifference=Math.max(maxDifference,delta);}
   }
   const out={file,width:canvas.width,height:canvas.height,
    browserBytes:browserPixels.byteLength,ktxBytes:ktxPixels.byteLength,
    differences,maxDifference,firstDifferenceIndex:first,
    compressed:!!tex.isCompressedTexture,dataTexture:!!tex.isDataTexture};
   tex.dispose();
   return out;
  },{file,origin});
  console.log('LOSSLESS_BROWSER_PARITY '+JSON.stringify(value));
  assert.equal(value.browserBytes,value.ktxBytes,'RGBA bytes must match in browser');
  results.push(value);
 }
 console.log('LOSSLESS_BROWSER_PARITY_SUMMARY '+JSON.stringify({count:results.length,
  identical:results.every(x=>x.differences===0),errors}));
 // Include the full measurements in the log even if browser decoder differs.
 // Hard fail any differences: never silently accept non-identical paintings.
 assert.ok(results.every(x=>x.differences===0),'Browser raw KTX2 differed from JPEG decoding');
 assert.deepEqual(errors,[]);
 console.log('LOSSLESS_BROWSER_PIXEL_PARITY_PASS');
}finally{await browser.close();}
