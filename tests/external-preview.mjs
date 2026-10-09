// Observe whether the temporary third-party GitHub static preview is reachable.
// This check does not affect the production site or fail local rendering tests.
import {writeFile,mkdir} from 'node:fs/promises';
const dir=new URL('../preview/screenshots/',import.meta.url);
await mkdir(dir,{recursive:true});
const url='https://raw.githack.com/southernadd-cmyk/algoart/feature/portrait-support/index.html?v=6&mode=organic&seed=PORTRAIT-PREVIEW-2026&fmt=portrait';
const report={url,checkedAt:new Date().toISOString(),status:'unknown'};
try{
  const res=await fetch(url,{signal:AbortSignal.timeout(15000)});
  const data=await res.text();
  report.status=res.status;
  report.finalUrl=res.url;
  report.contentType=res.headers.get('content-type');
  report.hasOrientationControl=data.includes('id="orientation"');
  report.hasCanvas=data.includes('id="art"');
  report.looksUsable=res.ok&&report.hasOrientationControl&&report.hasCanvas&&/text\/html/i.test(report.contentType||'');
}catch(err){report.error=String(err);}
await writeFile(new URL('external-preview-check.json',dir),JSON.stringify(report,null,2)+'\n');
console.log('Third-party static preview:',JSON.stringify(report));
