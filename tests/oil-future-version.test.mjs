import assert from 'node:assert/strict';
import fs from 'node:fs';
import {oilVersionForDate} from '../automation/oil-edition.mjs';
const generator=fs.readFileSync('automation/generate-social.mjs','utf8');
const slot=fs.readFileSync('automation/oil-slot.mjs','utf8');
const app=fs.readFileSync('js/app.js','utf8');
assert.equal(oilVersionForDate('2026-10-16'),'oil-v1');
assert.equal(oilVersionForDate('2026-10-17'),'oil-v4');
assert.equal(oilVersionForDate('2026-10-25'),'oil-v4');
assert.equal(oilVersionForDate('2026-10-26'),'oil-v6');
assert.equal(oilVersionForDate('2026-10-30'),'oil-v6');
assert.equal(oilVersionForDate('2026-10-31'),'oil-v7');
assert.equal(oilVersionForDate('2026-12-01'),'oil-v7');
assert.equal((generator.match(/oilVersionForDate\(day\)/g)||[]).length,2,'Generation and URL verification use one date policy');
assert.match(slot,/oilVersionForDate\(day\)/,'Publishing verifies the same frozen edition');
for(let version=1;version<=7;version++)assert.match(app,new RegExp('if\\(oilPaintV'+version+'Enabled\\(\\)\\)return A\\.renderOilPaintV'+version),'Versioned editor links retain their own renderer');
console.log('PASS Oil V7 cutover: past editions frozen; studio and publishing use versioned renderers.');


