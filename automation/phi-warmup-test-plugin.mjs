// Only the independent test build receives these preparation hooks.
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export function instrumentWarmupSource(source){
 const before="from './gallery-entry-preparation.mjs'";
 if(source.split(before).length!==2)throw Error('Test entry preparation import changed');
 source=source.replace(before,"from '../../test/virtual-gallery/phi-entry-warmup.mjs'");
 const call='warmGalleryEntry({renderer,scene,camera})';
 if(source.split(call).length!==3)throw Error('Expected startup and lift warm-up calls');
 return source.replaceAll(call,'warmGalleryEntry({renderer,scene,camera,prepare:()=>{phiPhotoreal?.prepare();phiLightingStudy?.prepare?.();},shadowStats:phiLightingStudy?.stats})');
}
export function instrumentShadowPreparation(source){
 const before='return {stats,update,editionChanged};';
 if(source.split(before).length!==2)throw Error('Test lighting preparation anchor changed');
 // Scan immediately without forcing a map redraw: the existing caster
 // signature decides whether the cached shadows actually need refreshing.
 return source.replace(before,'return {stats,update,editionChanged,prepare(){lastScan=-Infinity;lastPick=-Infinity;update();}};');
}
export function warmupTestPlugin(){return {name:'test-shader-preparation',setup(builder){
 builder.onLoad({filter:/[/\\]phi-room-lighting-renderer[.]mjs$/},async({path})=>({
  contents:instrumentShadowPreparation(await readFile(path,'utf8')),loader:'js',resolveDir:dirname(path)
 }));
}};}
