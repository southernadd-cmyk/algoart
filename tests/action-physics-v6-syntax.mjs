import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const file='test/action-physics-v6/index.html';
const html=readFileSync(file,'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
if(scripts.length!==1)throw Error('Expected one inline script, got '+scripts.length);
try{new vm.Script(scripts[0],{filename:file});console.log('PASS V6 study inline script syntax');}
catch(err){console.error(err.stack);process.exitCode=1;}
