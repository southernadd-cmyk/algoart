import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
// N8AO is now shared with production. Test only exposes the comparison panel.
export function patchN8AOTest(source){
 const anchor=' if(production)panel.hidden=true;';
 if(source.split(anchor).length!==2)throw Error('N8AO test anchor changed');
 return source.replace(anchor,' panel.hidden=false;');
}
export function n8aoTestPlugin(){return {name:'n8ao-test-only',setup(builder){
 builder.onLoad({filter:/[/\\]phi-post-fx[.]mjs$/},async({path})=>({
  contents:patchN8AOTest(await readFile(path,'utf8')),loader:'js',resolveDir:dirname(path)
 }));
}};}
