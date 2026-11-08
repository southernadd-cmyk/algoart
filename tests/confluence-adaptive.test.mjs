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
