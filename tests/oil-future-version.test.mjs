import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OIL_V8_CUTOVER,oilVersionForDate,verifyReleasedOilV8} from '../automation/oil-edition.mjs';
const generator=fs.readFileSync('automation/generate-social.mjs','utf8');
const slot=fs.readFileSync('automation/oil-slot.mjs','utf8');
const app=fs.readFileSync('js/app.js','utf8');
assert.equal(oilVersionForDate('2026-10-16'),'oil-v1');
assert.equal(oilVersionForDate('2026-10-17'),'oil-v4');
assert.equal(oilVersionForDate('2026-10-25'),'oil-v4');
assert.equal(oilVersionForDate('2026-10-26'),'oil-v6');
assert.equal(oilVersionForDate('2026-10-30'),'oil-v6');
assert.equal(oilVersionForDate('2026-10-31'),'oil-v7');
assert.equal(oilVersionForDate('2026-11-06'),'oil-v7');
if(OIL_V8_CUTOVER){
 const previous=new Date(OIL_V8_CUTOVER+'T00:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);
 assert.equal(oilVersionForDate(previous.toISOString().slice(0,10)),'oil-v7');
 assert.equal(oilVersionForDate(OIL_V8_CUTOVER),'oil-v8');
}else assert.equal(oilVersionForDate('2026-12-01'),'oil-v7');
assert.equal((generator.match(/oilVersionForDate\(day\)/g)||[]).length,1,'Generation and URL verification use one date policy');
assert.match(slot,/oilVersionForDate\(day\)/,'Publishing verifies the same frozen edition');
for(let version=1;version<=7;version++)assert.match(app,new RegExp('if\\(oilPaintV'+version+'Enabled\\(\\)\\)return A\\.renderOilPaintV'+version),'Versioned editor links retain their own renderer');
assert.match(app,/if\(oilPaintV8Enabled\(\)\)return A\.renderReleasedOilPaintV8/);
const released={version:'oil-paint-v8',options:{masses:true,relief:true,weave:true,amount:0.6}};
verifyReleasedOilV8(released);
assert.throws(()=>verifyReleasedOilV8({...released,options:{...released.options,weave:false}}),/released paint settings/);
assert.throws(()=>verifyReleasedOilV8(null),/released paint settings/);
console.log('PASS Oil edition cutover, versioned editor routes and V8 render validation.');


