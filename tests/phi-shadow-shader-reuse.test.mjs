import assert from 'node:assert/strict';
import test from 'node:test';
import {createPhiShadowReceiverMarker} from '../test/virtual-gallery/phi-shadow-shader-reuse.mjs';

const material=()=>({updates:0,set needsUpdate(v){if(v)this.updates++;}});

test('baseline preserves one invalidation per newly shadow-receiving object',()=>{
 const m=material(),marker=createPhiShadowReceiverMarker();
 marker.mark({receiveShadow:false,material:m});
 marker.mark({receiveShadow:false,material:m});
 assert.equal(m.updates,2);
 assert.equal(marker.stats.invalidations,2);
 assert.equal(marker.stats.skippedInvalidations,0);
});

test('test opt-in deduplicates material shader invalidation without suppressing any shadow receiver',()=>{
 const m=material(),marker=createPhiShadowReceiverMarker({reuse:true});
 const a={receiveShadow:false,material:m},b={receiveShadow:false,material:m};
 assert.equal(marker.mark(a),true);
 assert.equal(marker.mark(b),true);
 assert.equal(a.receiveShadow,true);
 assert.equal(b.receiveShadow,true);
 assert.equal(m.updates,1);
 assert.deepEqual(marker.stats,{enabled:true,receivers:2,invalidations:1,skippedInvalidations:1});
});

test('a different material still receives its necessary first shader update',()=>{
 const a=material(),b=material(),marker=createPhiShadowReceiverMarker({reuse:true});
 const target={receiveShadow:false,material:[a,b]};
 marker.mark(target);
 marker.mark({receiveShadow:false,material:a});
 assert.equal(a.updates,1);assert.equal(b.updates,1);
 assert.equal(target.receiveShadow,true);
 assert.equal(marker.stats.invalidations,2);
});

test('existing shadow receivers are not mutated or invalidated',()=>{
 const m=material(),marker=createPhiShadowReceiverMarker({reuse:true});
 assert.equal(marker.mark({receiveShadow:true,material:m}),false);
 assert.equal(m.updates,0);
});

test('non-shadow-related material properties are never changed',()=>{
 const m=material();
 Object.assign(m,{color:'#abcdef',roughness:0.48,metalness:0.2,map:{name:'original artwork map'}});
 createPhiShadowReceiverMarker({reuse:true}).mark({receiveShadow:false,material:m});
 assert.equal(m.color,'#abcdef');
 assert.equal(m.roughness,0.48);
 assert.equal(m.metalness,0.2);
 assert.equal(m.map.name,'original artwork map');
});
