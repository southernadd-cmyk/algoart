import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('test/oil-v8/index.html','utf8');
const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
if(blocks.length!==1)throw Error('Expected one inline study script, got '+blocks.length);
new vm.Script(blocks[0],{filename:'test/oil-v8/index.html'});
console.log('PASS Oil V8 study inline script syntax');