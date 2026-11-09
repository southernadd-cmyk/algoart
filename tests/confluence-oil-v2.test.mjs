import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {oilV2PlanCapture,oilV2FallbackFields,committedOilV2Evidence,oilV2SourceRGB}
  from '../confluence/oil-v2-geometry.js';

const sheet={width:1400,height:1000,inset:120};
const make=(id,points,guide)=>({
  groupId:id,fragmentNumber:0,fragmentTotal:1,system:'organic',
  points,guide,mark:1,width:11,ink:'#347c53'
});
test('Confluence oil v2 preserves original guide semantics using only committed placed ink',()=>{
  const history=[
    make('trunk',[{x:240,y:250},{x:310,y:360},{x:385,y:455}],
      {type:'organic',branch:1,depth:0}),
    make('crown',[{x:375,y:440},{x:450,y:400},{x:505,y:350}],
      {type:'organic',branch:1,depth:1})];
  const p=oilV2PlanCapture(history,{system:'organic'},sheet,'CV2');
  assert.equal(p.capture.meta.guide.type,'organic');
  assert.equal(p.capture.meta.guide.segments.length,2);
  assert.equal(p.capture.paths.length,2);
  assert.deepEqual(p.capture.meta.guide.segments.map(s=>s.depth),[0,1]);
  const filled=oilV2FallbackFields(p.groups,sheet,'CV2');
  assert(filled.length>0,'Distinct, adjacent committed source groups should provide a filled region');
  assert(filled[0].area>=8500);
  assert.equal(filled[0].kind,'guide-chain-colour-mass');
  assert.equal(filled[0].guideIds.length,2);
});
test('Oil v2 converts the exact CSS HSL palette syntax to source RGB, never brown fallback',()=>{
  // js/palettes.js:A.hues() returns hsl(H S% L%) for every palette.
  assert.deepEqual(oilV2SourceRGB('hsl(0 100% 50%)'),[255,0,0]);
  assert.deepEqual(oilV2SourceRGB('hsl(120 100% 50%)'),[0,255,0]);
  assert.deepEqual(oilV2SourceRGB('hsl(240 100% 50%)'),[0,0,255]);
  assert.deepEqual(oilV2SourceRGB('hsl(0 0% 50%)'),[128,128,128]);
  assert.deepEqual(oilV2SourceRGB('hsl(360 100% 50%)'),[255,0,0]);
  assert.deepEqual(oilV2SourceRGB('hsl(22.5 100% 50%)'),[255,96,0]);
  assert.deepEqual(oilV2SourceRGB('rgb(10, 210, 255)'),[10,210,255]);
  assert.deepEqual(oilV2SourceRGB('#0033ff'),[0,51,255]);
  assert.throws(()=>oilV2SourceRGB('not-a-colour'),/Unsupported Confluence oil-v2 source pigment/);
});
test('Oil v2 filled colour areas inherit both HSL source hues, not one brown substitute',()=>{
  const history=[
    {...make('blue',[{x:240,y:250},{x:310,y:360},{x:385,y:455}],
      {type:'organic',branch:1,depth:0}),ink:'hsl(220 100% 50%)'},
    {...make('orange',[{x:375,y:440},{x:450,y:400},{x:505,y:350}],
      {type:'organic',branch:1,depth:1}),ink:'hsl(25 100% 50%)'}
  ];
  const capture=oilV2PlanCapture(history,{system:'organic'},sheet,'CV2-HSL');
  const fills=oilV2FallbackFields(capture.groups,sheet,'CV2-HSL');
  assert(fills.length>0,'The committed source marks should form a filled oil area');
  const allColours=fills.flatMap(f=>f.paintPalette.map(c=>c.join(',')));
  assert(allColours.includes('0,85,255'),'Blue source palette colour missing from filled oil');
  assert(allColours.includes('255,106,0'),'Orange source palette colour missing from filled oil');
  assert(!allColours.includes('80,70,65'),'The old hard-coded brown must never be substituted');
  for(const fill of fills){
    assert.deepEqual(fill.paintPalette,fill.palette);
    assert.deepEqual(fill.rgb,fill.paintRgb);
  }
});
test('Confluence oil v2 never projects future geometry into an incomplete turn',()=>{
  const partial=[make('trunk',[{x:240,y:250},{x:330,y:360}],{type:'organic',branch:1,depth:0})];
  const p=oilV2PlanCapture(partial,{system:'organic'},sheet,'CV2');
  assert.equal(p.capture.paths.length,1);
  assert.equal(oilV2FallbackFields(p.groups,sheet,'CV2').length,0);
});
test('Confluence oil v2 transforms recorded physical points with progressive plans',()=>{
  const action={artist:{system:'organic',inks:['#347c53']},
    group:{id:'growth-1',fragmentParent:'growth-1',fragmentNumber:1,fragmentTotal:4,
      oilGuide:{type:'organic',branch:3,depth:1},
      traces:[{mark:9,width:10,points:[{x:50,y:60},{x:80,y:90}]}]},
    placement:{place:p=>({x:p.x+100,y:p.y+200})},
    plans:new Map()};
  const records=committedOilV2Evidence([action],()=> '#347c53');
  assert.equal(records.length,1);
  assert.deepEqual(records[0].points,[{x:150,y:260},{x:180,y:290}]);
  assert.equal(records[0].fragmentNumber,1);
  assert.equal(records[0].guide.branch,3);
});
test('Older shared studies stay v1; fresh studies and post-canary editions use v2',()=>{
  const ui=readFileSync(new URL('../confluence/ui.js',import.meta.url),'utf8');
  const materials=readFileSync(new URL('../confluence/materials.js',import.meta.url),'utf8');
  const share=readFileSync(new URL('../confluence/share-study.js',import.meta.url),'utf8');
  assert.match(ui,/let confluenceRenderer = 2/);
  assert.match(ui,/restored\?\(restored\.confluenceRenderer\?\?1\)/);
  assert.match(ui,/confluenceRenderer===2\?\{confluenceRenderer:2\}:\{\}/);
  assert.match(materials,/rendererVersion===2/);
  assert.match(share,/data\.confluenceRenderer===undefined/);
  const daily=readFileSync(new URL('../automation/generate-gallery-confluence.mjs',import.meta.url),'utf8');
  assert.match(daily,/day>='2026-11-11'\?2:1/);
  assert.match(daily,/confluenceRenderer===2\?\{confluenceRenderer:2\}:\{\}/);
  assert.match(ui,/params\.get\('cv'\)==='1'\?1:2/);
});
