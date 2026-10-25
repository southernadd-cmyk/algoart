import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for(const version of [1,2,3]){
 let chosen=null,options=null;
 const A={renderActionPainting(c,s,scale,reveal,o){chosen='legacy';options=o},renderActionPaintingV3(c,s,scale,reveal,o){chosen='v3';options=o}};
 const document={createElement:()=>({toBlob:callback=>callback({size:32})})};
 vm.runInNewContext(readFileSync('js/export.js','utf8'),{window:{AlgoArt:A},document});
 const settings={seed:'ACTION-PNG-VERSION',mode:'rects',actionPaintingRender:true,actionPaintingRevision:version},before=JSON.stringify(settings);
 const file=await A.preparePNG(settings,1);
 assert.equal(chosen,version===3?'v3':'legacy');assert.equal(options.version,version);
 assert(file.filename.includes('-action-v'+version+'-1x.png'));assert.equal(JSON.stringify(settings),before);
}
console.log('PASS Action PNG dispatch: V3 uses its reviewed renderer; V1/V2 retain the historical renderer.');
