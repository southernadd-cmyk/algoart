// Refuse publication of an archive floor that cannot safely display every study.
import {readFile} from 'node:fs/promises';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
const archive=JSON.parse(await readFile(new URL('../gallery/tower-layouts.json',import.meta.url),'utf8'));
let checked=0;
for(const floor of archive.floors){
 const meta=JSON.parse(await readFile(new URL('../gallery/'+floor.date+'/meta.json',import.meta.url),'utf8'));
 const studies=meta.entries.map((s,id)=>{const portrait=(s.orientation||s.settings?.orientation)==='portrait';return {id,portrait,aspect:portrait?1/1.4:1.4};});
 if(studies.length!==floor.studies.length)throw new Error('Archive index count differs from metadata for '+floor.date);
 const p=buildPhiRendererPlan(floor.date,studies),c=p.checks;
 if(c.unplaced||!c.connected||!c.count||!c.unique||!c.inwardFacing||!c.clearances)throw new Error('Unsafe phi floor '+floor.date+': '+JSON.stringify(c));
 checked++;
}
console.log('Phi archive validated:',checked,'complete, connected exhibition floors');
