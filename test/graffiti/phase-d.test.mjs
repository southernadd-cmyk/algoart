import test from 'node:test';
import assert from 'node:assert/strict';
import {LETTERS,FAMILIES,BY_ID,getFamily,getGlyph,composeWord,auditFamilies,stableNoise} from './family-library.mjs';
import {PHI_BY_FAMILY} from './family-symbols.mjs';
import {joinPolicy,shouldConsiderJoin,CONNECTING_FAMILIES} from './family-joins.mjs';
const STYLES='ABCDEFGHIJ';
function assertPath(d,where){
 const regex=/[MLCQZ]|[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/g;
 assert.equal(d.replace(regex,'').replace(/\s+/g,''),'','Unparsed SVG tokens in '+where);
 const t=[...d.matchAll(regex)].map(m=>m[0]);let i=0,moveCount=0;
 while(i<t.length){
  const cmd=t[i++],arity={M:2,L:2,C:6,Q:4,Z:0}[cmd];
  assert.notEqual(arity,undefined,where+': unexpected command '+cmd);
  for(let j=0;j<arity;j++){
   assert.ok(i<t.length,where+': missing coordinate');
   const n=Number(t[i++]);assert.ok(Number.isFinite(n),where+': nonfinite coordinate');
   assert.ok(Math.abs(n)<=150,where+': coordinate outside authored sheet');
  }
  moveCount++;
 }
 assert.ok(moveCount>=2,where+' must contain a real segment');
}
test('Exactly ten source-informed independent complete A-Z families',()=>{
 assert.equal(FAMILIES.length,10);
 assert.equal(Object.keys(BY_ID).length,10);
 assert.equal(FAMILIES.map(f=>f.id).join(''),STYLES);
 for(const f of FAMILIES){
  assert.equal(Object.keys(f.glyphs).length,26);
  assert.ok(Number.isSafeInteger(f.primary)&&f.primary>=1&&f.primary<=60);
  assert.ok(f.anchors.includes(f.primary));
  assert.ok(f.notes.length>=2);
  for(const ch of LETTERS)assert.ok(f.glyphs[ch],'Missing '+f.id+ch);
 }
});
test('All 260 glyphs use independent authored paths with valid SVG geometry',()=>{
 let n=0;const signatures=new Set();
 for(const f of FAMILIES){
  const local=new Set();
  for(const ch of LETTERS){
   const g=getGlyph(f.id,ch);
   assert.ok(g.shapes.length>=1);
   const signature=g.shapes.map(s=>s.kind+':'+s.d).join('|');
   assert.ok(!local.has(signature),'Duplicate glyph construction within family '+f.id+ch);
   local.add(signature);
   for(const shape of g.shapes){
    assert.ok(['stroke','heavy','hairline','fill'].includes(shape.kind),f.id+ch);
    assertPath(shape.d,f.id+ch);
    n++;
   }
  }
  signatures.add([...local].join('!'));
 }
 assert.equal(signatures.size,10);
 assert.ok(n>=600,'There should be substantial deliberately authored stroke geometry');
});
test('The anatomical styles use different construction systems, not just marker widths',()=>{
 assert.equal(getFamily('C').technique,'blade');
 assert.equal(getFamily('D').technique,'block');
 assert.equal(getFamily('E').technique,'gothic');
 assert.equal(getFamily('F').technique,'nib');
 assert.equal(getFamily('H').technique,'fragment');
 assert.equal(getFamily('I').technique,'chisel');
 const audit=auditFamilies();
 assert.equal(audit.length,10);
 assert.ok(audit.every(x=>x.uniqueLetters===26));
 assert.equal(new Set(audit.map(x=>x.geometryFingerprint)).size,10);
 const filled=f=>Object.values(getFamily(f).glyphs).flatMap(g=>g.shapes).filter(s=>s.kind==='fill').length;
 assert.ok(filled('C')>=26&&filled('E')>=26&&filled('H')>=26);
 assert.equal(filled('B'),0);assert.equal(filled('I'),0);
});
test('All test words work across every alphabet, without fallback lettering',()=>{
 for(const f of FAMILIES)for(const word of ['SKUF','PHI','φ','MUSHROOM','PROPORTION PIECE','ABCDEFGHIJKLMNOPQRSTUVWXYZ']){
  const planned=composeWord(f.id,word);
  assert.equal(planned.letters.map(x=>x.ch).join(''),word.toUpperCase().replace(/ /g,''));
  assert.ok(planned.width>80);
  assert.ok(planned.letters.every(x=>x.glyph===getGlyph(f.id,x.ch)));
 }
});
test('Seeded variations remain deterministic and leave geometry untouched',()=>{
 for(const f of FAMILIES){
  const a=composeWord(f.id,'PROPORTION PIECE',{seed:'100'});
  const b=composeWord(f.id,'PROPORTION PIECE',{seed:'100'});
  const c=composeWord(f.id,'PROPORTION PIECE',{seed:'101'});
  assert.deepEqual(a,b);
  assert.notDeepEqual(a.letters.map(({x,y,rotation})=>[x,y,rotation]),c.letters.map(({x,y,rotation})=>[x,y,rotation]));
  assert.deepEqual(a.letters.map(x=>x.glyph),c.letters.map(x=>x.glyph));
  assert.ok(a.letters.every(x=>Math.abs(x.rotation)<=.2&&Math.abs(x.y)<=.36));
 }
 assert.equal(stableNoise('a'),stableNoise('a'));
});
test('Unknown style, invalid text and excessive variation are rejected',()=>{
 assert.throws(()=>getFamily('Z'),RangeError);
 assert.throws(()=>getGlyph('A','6'),RangeError);
 assert.throws(()=>composeWord('A','1234'),RangeError);
 assert.throws(()=>composeWord('A','TAG',{variation:.5}),RangeError);
});

test('Ten independent phi signatures are not one shared copied shape',()=>{
 const variants=new Set();
 for(const f of FAMILIES){
  const glyph=getGlyph(f.id,'φ');
  assert.equal(glyph.letter,'Φ');
  assert.equal(glyph,PHI_BY_FAMILY[f.id]);
  assert.ok(glyph.shapes.length>=2,f.id);
  for(const shape of glyph.shapes)assertPath(shape.d,f.id+' Φ');
  const signature=glyph.shapes.map(s=>s.d).join('|');
  assert.ok(!variants.has(signature),'Repeated phi signature in '+f.id);
  variants.add(signature);
  const word=composeWord(f.id,'φ PHI');
  assert.equal(word.letters.map(x=>x.ch).join(''),'ΦPHI');
 }
 assert.equal(variants.size,10);
});
test('Only appropriate families and adjacent letters may receive contextual joins',()=>{
 assert.deepEqual(CONNECTING_FAMILIES,['A','B','F','G','J']);
 for(const id of 'CDEHI')assert.equal(joinPolicy(id),null);
 for(const id of CONNECTING_FAMILIES){
  assert.ok(joinPolicy(id).width>0);
  const doc=composeWord(id,'MUSHROOM',{seed:'fixed'});
  const first=doc.letters[0],second=doc.letters[1];
  assert.equal(shouldConsiderJoin(id,first,second,'fixed'),shouldConsiderJoin(id,first,second,'fixed'));
  assert.equal(shouldConsiderJoin(id,first,{...second,index:second.index+1},'fixed'),false);
  assert.equal(shouldConsiderJoin(id,first,{...second,ch:'Φ'},'fixed'),false);
 }
});
test('Reference-informed weak families were rebuilt, not simply recoloured',()=>{
 const b=getFamily('B'),i=getFamily('I');
 assert.equal(b.technique,'crosshand');
 assert.equal(i.technique,'chisel');
 assert.ok(b.weight>=6);
 assert.ok(i.weight>=10);
 assert.ok(Object.values(b.glyphs).every(g=>g.shapes.length>=2));
 assert.ok(Object.values(i.glyphs).every(g=>g.shapes.length>=2));
});
