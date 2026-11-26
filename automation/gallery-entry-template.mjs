import assert from 'node:assert/strict';
const head=/<!-- GS6_HEAD_START -->[\s\S]*?<!-- GS6_HEAD_END -->/g;
const entry=/\/\* GS6_ENTRY_START \*\/[\s\S]*?\/\* GS6_ENTRY_END \*\//g;
const meshUrl=/\.\/gallery-phi-sculpture-v2-test-bundle\.js\?v=[A-Za-z0-9._-]+/g;
const splatUrl=/\.\/gallery-phi-splats-bundle\.js\?v=[A-Za-z0-9._-]+/g;
export function normalizeGalleryEntry(html){
 const heads=[...html.matchAll(head)],entries=[...html.matchAll(entry)];
 assert.equal(heads.length,1,'Exactly one production renderer selection head required');
 assert.equal(entries.length,1,'Exactly one production renderer selection entry required');
 const h=heads[0][0],e=entries[0][0];
 const meshes=[...h.matchAll(meshUrl),...e.matchAll(meshUrl)].map(m=>m[0]);
 const splats=[...h.matchAll(splatUrl),...e.matchAll(splatUrl)].map(m=>m[0]);
 assert.equal(meshes.length,3,'Mesh preload, explicit rollback and automatic fallback must agree');
 assert.equal(new Set(meshes).size,1,'Mesh release mismatch');
 assert.equal(splats.length,2,'Gaussian preload and entry must agree');
 assert.equal(new Set(splats).size,1,'Gaussian release mismatch');
 assert.match(h,/get\('sculptures'\)==='mesh'\?/);
 assert.match(e,/get\('sculptures'\)==='mesh'/);
 assert.match(e,/if\(meshOnly\)\s*\{/);
 assert.match(e,/catch\(splatError\)/);
 const normalized=html.replace(head,'<link rel="modulepreload" href="'+meshes[0]+'">').replace(entry,"await import('"+meshes[0]+"');");
 assert.equal([...normalized.matchAll(meshUrl)].length,2,'Isolated preload and import must use one mesh bundle');
 assert.equal([...normalized.matchAll(splatUrl)].length,0,'Isolated viewer must not import production Gaussian renderer');
 return {html:normalized,mesh:meshes[0],splats:splats[0]};
}
