import assert from 'node:assert/strict';
import test from 'node:test';
import {inferResponse} from '../confluence/adaptive-response.js';

const sheet={cols:10,rows:10,width:160,height:160};
const probes=[
 {p:{x:56,y:56},next:{x:78,y:56}},
 {p:{x:72,y:56},next:{x:94,y:56}},
 {p:{x:88,y:56},next:{x:110,y:56}}
];
const group={probes};
const artist={pose:{place:p=>p}};
function field(angle,dist=35){
 const distances=new Float32Array(100);distances.fill(dist);
 const angles=new Float32Array(100);angles.fill(angle);
 return {distances,angle:angles};
}
const density=load=>({at:()=>load});
test('Unmarked space naturally favours weaving without random decisions',()=>{
 const result=inferResponse(group,artist,[],density(.05),sheet);
 assert.equal(result.mode,'weave');
 assert.equal(result.response.gap,40);
 assert.deepEqual(inferResponse(group,artist,[],density(.05),sheet),result);
});
test('Parallel neighbouring strokes cause a directional echo',()=>{
 const result=inferResponse(group,artist,[field(0)],density(.05),sheet);
 assert.equal(result.mode,'echo');
 assert(result.response.alignment>.60);
 assert(result.response.gap<40);
});
test('Crowded paint and washes cause negative-space protection',()=>{
 const result=inferResponse(group,artist,[field(0,12)],density(2.2),sheet);
 assert.equal(result.mode,'space');
 assert(result.response.gap>70);
 assert(result.response.overlap>2.3);
});
test('Changing the previous artist\'s marks changes the next response',()=>{
 const aligned=inferResponse(group,artist,[field(0)],density(.05),sheet);
 const crossed=inferResponse(group,artist,[field(Math.PI/2)],density(.05),sheet);
 assert.equal(aligned.mode,'echo');
 assert.equal(crossed.mode,'weave');
 assert.notDeepEqual(aligned.response,crossed.response);
});
test('Existing material coverage changes response even when geometry is held fixed',()=>{
 const relaxed=inferResponse(group,artist,[field(0)],density(.05),sheet);
 const covered=inferResponse(group,artist,[field(0)],density(2.2),sheet);
 assert.notEqual(relaxed.mode,covered.mode);
});

import {capRectangleFootprint,rectangleInteriors,interiorCandidates}
  from '../confluence/rect-collaboration.js';

test('Recursive Divisions footprint respects φ pull without changing its source geometry',()=>{
 const page={width:1400,height:1000};
 const points=[{x:0,y:0},{x:1400,y:0},{x:1400,y:1000},{x:0,y:1000}];
 const groups=[{probes:points.map(p=>({p,next:p}))}];
 const place=capRectangleFootprint(groups,p=>p,{x:700,y:500},page,100);
 const mapped=points.map(place);
 const bounds={w:Math.max(...mapped.map(p=>p.x))-Math.min(...mapped.map(p=>p.x)),
   h:Math.max(...mapped.map(p=>p.y))-Math.min(...mapped.map(p=>p.y))};
 assert(Math.abs(bounds.w*bounds.h/(1400*1000)-.55)<.00001);
 assert.deepEqual(points[0],{x:0,y:0},'Source marks must remain untouched');
 const small=capRectangleFootprint(groups,p=>({x:700+(p.x-700)*.35,
   y:500+(p.y-500)*.35}),{x:700,y:500},page,100);
 assert(Math.abs(small({x:0,y:0}).x-455)<.001,'Small frames should not shrink further');
});

test('Only actual scheduled Recursive Divisions cells invite responding artists',()=>{
 const page={width:1400,height:1000};
 const room={x:280,y:220,w:320,h:250};
 const rect={id:1,system:'rects',pose:{place:p=>({x:p.x+100,y:p.y+50})},
   groups:[
     {info:{section:'frame'},cell:{x:0,y:0,w:1200,h:900}},
     {info:{section:'cells'},cell:room},
     {info:{section:'cells'},cell:{x:25,y:25,w:40,h:40}}
   ]};
 const rooms=rectangleInteriors([rect],page);
 assert.equal(rooms.length,1);
 assert.equal(rooms[0].x,380);
 assert.equal(rooms[0].y,270);
 const responding={number:2,pose:{place:p=>p},anchors:new Map()};
 const strokes=[{x:0,y:0},{x:200,y:0},{x:200,y:160},{x:0,y:160}];
 const mark={center:{x:100,y:80},
   traces:[{points:strokes}],
   probes:strokes.map(p=>({p,next:p}))};
 const options=interiorCandidates(mark,responding,rooms,3);
 assert.equal(options.length,1);
 const inside=strokes.map(options[0].place);
 assert(inside.every(p=>p.x>rooms[0].x&&p.x<rooms[0].x+rooms[0].w));
 assert(inside.every(p=>p.y>rooms[0].y&&p.y<rooms[0].y+rooms[0].h));
 assert.equal(options[0].insideRect,true);
 const locked={...mark,links:[{x:10,y:20}]};
 const anchored={...responding,anchors:new Map([['10.0000,20.0000',{}]])};
 assert.deepEqual(interiorCandidates(locked,anchored,rooms,3),[],
   'Established network links must not be broken by new cell invitations');
 assert.deepEqual(rectangleInteriors([{...rect,system:'network'}],page),[]);
});

import {expandRecursiveTurns,sliceStroke} from '../confluence/recursive-turns.js';
import {turnBudget,fibonacciTurnOptions} from '../confluence/composition.js';

test('Recursive Divisions supports 55 and 89 turns without drawing extra geometry',()=>{
 const sampler=commands=>commands.map(c=>c.points[0]);
 const makeGroup=i=>{
   const x=40+i*7,y=30+i*5;
   const points=[{x,y},{x:x+180,y},{x:x+180,y:y+130},{x,y:y+130},{x,y}];
   const commands=points.map((p,j)=>({type:j?'L':'M',points:[p]}));
   const info={section:'cells'};
   return {id:'cell-'+i,info,label:'Cell '+i,
     cell:{x,y,w:180,h:130},pivot:{x:x+90,y:y+65},
     center:{x:x+90,y:y+65},probes:points.map(p=>({p,next:p})),
     traces:[{mark:i+1,kind:'rect',width:4,opacity:.8,passes:2,points}],
     paths:[0,1].map(pass=>({path:{mark:i+1,pass,passes:2,
       kind:'rect',width:4,opacity:.8,d:'original'},
       commands}))};
 };
 const original=Array.from({length:6},(_,i)=>makeGroup(i));
 const expanded=expandRecursiveTurns(original,sampler);
 assert(expanded.length>=56,'Six whole rectangles should support at least 56 genuine gestures');
 assert(fibonacciTurnOptions(turnBudget(
   [0,1,2].map(id=>({groups:expanded,id})))).includes(89));
 assert.equal(new Set(expanded.slice(0,6).map(g=>g.fragmentParent)).size,6,
   'Initial turns should reach multiple cells instead of one rectangle claiming the paper');
 for(let i=0;i<6;i++){
   const parts=expanded.filter(g=>g.fragmentParent==='cell-'+i)
      .sort((a,b)=>a.fragmentNumber-b.fragmentNumber);
   const originalLength=original[i].traces[0].points.reduce((sum,p,j,list)=>
     j?sum+Math.hypot(p.x-list[j-1].x,p.y-list[j-1].y):sum,0);
   const actual=parts.reduce((sum,g)=>sum+
     g.traces[0].points.reduce((n,p,j,list)=>
       j?n+Math.hypot(p.x-list[j-1].x,p.y-list[j-1].y):n,0),0);
   assert(Math.abs(actual-originalLength)<.001,
     'The recorded rectangle must be cut, not repeated or shortened');
   assert(parts.every(p=>p.paths.length===2),
     'Each source stroke fragment must keep every original ink pass');
   assert(parts.every(p=>p.traces[0].points.length>=2));
   assert.equal(parts[0].cell,original[i].cell);
 }
 assert.equal(original.length,6,'The source artwork must remain unchanged');
 const diagonal=[{x:0,y:0},{x:80,y:0},{x:80,y:120}];
 const pieces=Array.from({length:11},(_,i)=>sliceStroke(diagonal,i/11,(i+1)/11));
 assert(Math.hypot(pieces[0][0].x,pieces[0][0].y)<.000001);
 assert.deepEqual(pieces.at(-1).at(-1),diagonal.at(-1));
 for(let i=1;i<pieces.length;i++)
   assert(Math.hypot(pieces[i][0].x-pieces[i-1].at(-1).x,
     pieces[i][0].y-pieces[i-1].at(-1).y)<.00001);
});

import {makeSchedule,turnShares} from '../confluence/composition.js';

test('φ determines drawing cadence, never truncates any artist source drawing',()=>{
  const counts=[62,73,48];
  const roster=counts.map((count,i)=>({id:i+1,
    groups:Array.from({length:count},(_,j)=>({id:i+':'+j}))}));
  for(const pull of [0,35,62,100]){
    const programme=makeSchedule(roster,55,pull);
    assert.equal(programme.turns.length,55);
    assert.equal(programme.counts.reduce((sum,x)=>sum+x,0),55);
    assert(programme.counts.every(n=>n>0));
    for(const artist of roster){
      const turns=programme.turns.filter(t=>t.id===artist.id);
      const drawn=turns.reduce((sum,t)=>sum+t.groupQuota,0);
      assert.equal(drawn,artist.groups.length,
        'All source gestures must be assigned, including the last one');
      assert(turns.every(t=>t.groupQuota>0));
    }
  }
  const weighted=makeSchedule(roster,55,100).counts;
  const equal=makeSchedule(roster,55,0).counts;
  assert.notDeepEqual(weighted,equal,
    'φ should still change how often each artist takes a turn');
});

test('Complete source works even when turns are few compared with source marks',()=>{
  const counts=[65,56,61],roster=counts.map((count,i)=>({id:i,
    groups:Array.from({length:count},(_,j)=>({mark:j}))}));
  for(const total of [5,8,13,21,34,55,89]){
    if(total>counts.reduce((v,n)=>v+Math.min(n,Math.ceil(total/2)),0))continue;
    const turns=makeSchedule(roster,total,100);
    for(const artist of roster)
      assert.equal(turns.turns.filter(t=>t.id===artist.id)
        .reduce((n,t)=>n+t.groupQuota,0),artist.groups.length);
  }
});

import {wantsOilContact,oilContactCandidates,contactFraction}
  from '../confluence/oil-contact.js';
import {guardedAlpha,protectPigmentStack} from '../confluence/pigment-guard.js';

test('Oil contact invitations are seeded, structural, and never forced on every turn',()=>{
 const sheet={width:320,height:256,cols:20,rows:16,inset:8};
 const length=sheet.cols*sheet.rows;
 const field={distances:new Float32Array(length).fill(144),
   angle:new Float32Array(length),x:new Float32Array(length),
   y:new Float32Array(length)};
 for(let y=3;y<13;y++)for(let x=4;x<17;x++){
   const idx=x+y*sheet.cols;
   field.distances[idx]=2;
   field.x[idx]=x*16+8;field.y[idx]=y*16+8;field.angle[idx]=0;
 }
 const probes=[{p:{x:135,y:100},next:{x:162,y:100}},
   {p:{x:162,y:100},next:{x:185,y:100}}];
 const group={center:{x:160,y:100},probes,traces:[{points:probes.map(x=>x.p)}]};
 const artist={id:2,pose:{place:p=>p},anchors:new Map()};
 const options=oilContactCandidates(group,artist,[field],{at:()=>.25},sheet,8);
 assert(options.length>0,'Oil must have actual existing-ink placements');
 assert(options.some(c=>c.oilContact==='follow'));
 assert(options.some(c=>c.oilContact==='cross'));
 assert(options.every(c=>c.oilTarget.x>0&&c.oilTarget.y>0));
 const repeated=oilContactCandidates(group,artist,[field],{at:()=>.25},sheet,8);
 assert.deepEqual(options.map(c=>[c.oilContact,c.oilTarget]),
   repeated.map(c=>[c.oilContact,c.oilTarget]));
 assert(options.some(c=>contactFraction(group,c,[field],sheet)>0));
 const decisions=Array.from({length:100},(_,i)=>
   wantsOilContact('2331044488',2,i,100,75));
 assert(decisions.some(Boolean)&&decisions.some(x=>!x));
 assert(decisions.every((x,i)=>x===wantsOilContact('2331044488',2,i,100,75)));
 assert.equal(wantsOilContact('2331044488',2,17,0,0),false);
 const shapes=Array.from({length:20},(_,i)=>
   wantsOilContact('2331044488',2,'shapes/item-'+i,100,90));
 assert(shapes.some(Boolean)&&shapes.some(x=>!x),
   'Nearby shape IDs must not share the same Oil contact decision');
 assert.deepEqual(oilContactCandidates({...group,cell:{x:0}},artist,[field],null,sheet,8),[]);
});

test('Dark overlap guard preserves hue and first marks but restrains repeat blackening',()=>{
 assert.equal(guardedAlpha(245,245,245,0,10,0,1),1,
   'Dark isolated first marks must remain genuine');
 const reduced=guardedAlpha(85,78,73,5,12,9,.85);
 assert(reduced>0&&reduced<.85,'Repeated pigment should be locally limited');
 assert.equal(guardedAlpha(25,31,24,0,4,1,.9),0,
   'Further blackening of an already dark location must stop');
 assert.equal(guardedAlpha(75,70,68,170,130,80,.5),.5,
   'Lighter layers should stay untouched');
 const before={data:new Uint8ClampedArray([245,245,245,255,85,78,73,255])};
 const next={data:new Uint8ClampedArray([0,10,0,240,5,12,9,220])};
 const original=next.data.slice();
 const adjusted=protectPigmentStack(before,next);
 assert.equal(adjusted,1);
 assert.equal(next.data[3],original[3]);
 assert(next.data[7]<original[7]);
 assert.deepEqual([...next.data].filter((_,i)=>i%4!==3),
   [...original].filter((_,i)=>i%4!==3),'No pigment recolouring');
 assert.deepEqual([...before.data],[245,245,245,255,85,78,73,255]);
 const multiply=guardedAlpha(92,89,80,10,15,12,.8,'multiply');
 assert(multiply<.8,'Watercolour glaze cannot multiply established paint into black');
});

test('Rotating the lead moves the 27/17/11 shares without changing source work',()=>{
 const roster=[1,2,3].map(id=>({id,groups:Array.from({length:65},
   (_,i)=>({id:id+'-'+i}))}));
 const expected=[[27,17,11],[11,27,17],[17,11,27]];
 const equal=makeSchedule(roster,55,0,0);
 for(let lead=0;lead<3;lead++){
   const programme=makeSchedule(roster,55,100,lead);
   assert.deepEqual(programme.counts,expected[lead]);
   assert.deepEqual(makeSchedule(roster,55,0,lead),equal,
     'Equal-turn comparison must remain unchanged when lead rotates');
   for(const artist of roster){
     const delivered=programme.turns.filter(t=>t.id===artist.id)
       .reduce((n,t)=>n+t.groupQuota,0);
     assert.equal(delivered,artist.groups.length,
       'Each rotated lead still completes the identical source drawing');
   }
   const shares=turnShares(100,lead);
   assert.equal(shares.indexOf(Math.max(...shares)),lead);
   assert.deepEqual(turnShares(0,lead),[1/3,1/3,1/3]);
 }
 assert.deepEqual(roster.map(a=>a.id),[1,2,3],
   'Rotating lead never swaps the systems, palettes or artist identities');
});

test('Rotating lead preserves a stable available-turn ceiling',()=>{
 const groups=[42,67,92].map((count,i)=>({id:i,
   groups:Array.from({length:count},(_,j)=>({id:j}))}));
 const available=turnBudget(groups);
 assert(available>=55,'At least 55 turns should survive any lead order');
 for(let lead=0;lead<3;lead++){
   const plan=makeSchedule(groups,55,100,lead);
   assert(plan.counts.every((n,i)=>n<=groups[i].groups.length));
 }
});

import {selfOverlapAt,costAt} from '../confluence/mark-planner.js';
import {judge} from '../confluence/collab.js';

test('Same-hand provisional ink repels nearby marks but cannot attract at any preferred gap',()=>{
  const sheet={cols:10,rows:10,width:160,height:160,inset:0};
  const own={owner:1,distances:new Float32Array(100).fill(144),
    angle:new Float32Array(100).fill(0)};
  own.distances[3+3*10]=2;
  // For both scorers, own ink only raises the near collision cost.
  const near={x:56,y:56};
  const far={x:88,y:56};
  const farther={x:120,y:56};
  assert(selfOverlapAt(near,own,sheet,6)>0);
  assert.equal(selfOverlapAt(far,own,sheet,6),0);
  assert.equal(selfOverlapAt(farther,own,sheet,6),0);
  const context={fields:[],selfField:own,sheet,
    response:{gap:100,overlap:2.6,alignment:1.2},
    gain:1,mode:'weave',density:null};
  const nearCost=costAt(near,0,context,6);
  const farCost=costAt(far,0,context,6);
  const fartherCost=costAt(farther,0,context,6);
  assert(nearCost>farCost,'Own neighbouring mark must discourage collision');
  assert.equal(farCost,fartherCost,'Own ink cannot create a gap-width attraction');
  const source={probes:[{p:{x:0,y:0},next:{x:12,y:0}}]};
  const candidate=at=>({place:p=>({x:p.x+at.x,y:p.y+at.y}),effort:0});
  const nearJudge=judge(source,candidate(near),context,6);
  const farJudge=judge(source,candidate(far),context,6);
  const fartherJudge=judge(source,candidate(farther),context,6);
  assert(nearJudge>farJudge,'Judge must repel its own fresh ink');
  assert.equal(farJudge,fartherJudge,
    'Judge must not reward spacing its own gestures at a fixed distance');
  const empty={...context,selfField:null};
  assert.equal(judge(source,candidate(far),empty,6),farJudge,
    'Without collision, provisional ink has no scoring effect');
});

test('Self-only proximity does not create a false inter-artist echo',()=>{
  const contextSheet={cols:10,rows:10,width:160,height:160,inset:0};
  const self={owner:1,distances:new Float32Array(100).fill(6),
    angle:new Float32Array(100)};
  const ownOnly={fields:[],selfField:self,sheet:contextSheet,
    response:{gap:40,overlap:2.3,alignment:0},
    mode:'weave',gain:1,density:null};
  const response=inferResponse(group,artist,ownOnly.fields,null,contextSheet);
  assert.equal(response.mode,'weave');
  assert.equal(response.evidence.near,0);
  assert.equal(response.evidence.aligned,0);
});
