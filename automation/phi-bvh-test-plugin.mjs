import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export function patchBVHPicking(source){
 const anchor='root.add(model);root.userData.modelLoaded=true;';
 if(source.split(anchor).length!==2)throw Error('Gramophone BVH anchor changed');
 return "import {queuePhiPickBVH} from '../../test/virtual-gallery/phi-mesh-bvh.mjs';\n"+
  source.replace(anchor,anchor+'queuePhiPickBVH(model);');
}
export function bvhTestPlugin(){return {name:'gramophone-bvh-test-only',setup(builder){
 builder.onLoad({filter:/[/\\]phi-reception-gramophone[.]mjs$/},async({path})=>({
  contents:patchBVHPicking(await readFile(path,'utf8')),loader:'js',resolveDir:dirname(path)
 }));
}};}
