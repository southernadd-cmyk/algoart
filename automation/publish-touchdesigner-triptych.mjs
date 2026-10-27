// Publishes the exact, independently verified 27 Oct 2026 TouchDesigner export.
// Use on a local repo checkout (Cursor/terminal): node automation/publish-touchdesigner-triptych.mjs "C:\path\to\phase-one-triptych.webm"
// This prepares tracked files. Git commit/push is deliberately separate.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const EXPECTED_SHA256='d64dd7eda6c7bbb62ce90a19c8543791b455d16989a875fa4b7a72914c0ff9d0';
const EXPECTED_BYTES=3384087;
const source=process.argv[2];
if(!source){
 console.error('Usage: node automation/publish-touchdesigner-triptych.mjs "C:\\path\\to\\phase-one-triptych.webm"');
 process.exit(2);
}
const base=resolve(dirname(fileURLToPath(import.meta.url)),'../gallery/visit/touchdesigner');
const target=resolve(base,'phase-one-triptych.webm');
const manifestPath=resolve(base,'phase-one.json');
const bytes=await readFile(resolve(source));
const sha=createHash('sha256').update(bytes).digest('hex');
if(bytes.length!==EXPECTED_BYTES||sha!==EXPECTED_SHA256){
 throw new Error('Refusing unexpected TouchDesigner video: got '+bytes.length+' bytes / SHA256 '+sha+
  ' (expected the verified 3,384,087-byte VP9 export).');
}
// EBML/WebM container magic.
if(bytes.subarray(0,4).toString('hex')!=='1a45dfa3')
 throw new Error('Video is not an EBML/WebM container');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.triptych?.file!=='phase-one-triptych.webm'||
   manifest.triptych?.width!==1152||manifest.triptych?.height!==240||
   manifest.triptych?.fps!==24||manifest.triptych?.durationSeconds!==20||
   manifest.artwork?.seed!=='OL-20261027-02-57201')
 throw new Error('Manifest no longer matches this verified export');
await mkdir(base,{recursive:true});
await copyFile(resolve(source),target);
manifest.status='published';
manifest.triptych.sha256=EXPECTED_SHA256;
manifest.triptych.sizeBytes=EXPECTED_BYTES;
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log('Prepared real TouchDesigner video and published manifest in the local checkout.');
console.log('SHA256: '+sha);
console.log('Commit and push BOTH of these paths together:');
console.log('  gallery/visit/touchdesigner/phase-one-triptych.webm');
console.log('  gallery/visit/touchdesigner/phase-one.json');
console.log('The live tower does not enable this installation; the test tower does.');
