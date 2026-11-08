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
