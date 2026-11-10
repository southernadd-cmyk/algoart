import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('test/oil-v8-replacement/index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
if(scripts.length!==1)throw Error('Expected one inline script, got '+scripts.length);
new vm.Script(scripts[0],{filename:'test/oil-v8-replacement/index.html'});
console.log('PASS Oil V8 lab script syntax');
