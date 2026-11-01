import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhiUploadedTextureLedger} from '../test/virtual-gallery/phi-uploaded-texture-ledger.mjs';

test('never reuse unknown texture, then allow a successfully uploaded unchanged texture',()=>{
 const ledger=createPhiUploadedTextureLedger(),texture=new THREE.Texture();
 assert.equal(ledger.has(texture),false);
 assert.equal(ledger.mark(texture),true);
 assert.equal(ledger.has(texture),true);
 assert.equal(ledger.stats().cacheHits,1);
});
test('invalidate on dispose, even when texture object survives with the same version',()=>{
 const ledger=createPhiUploadedTextureLedger(),texture=new THREE.Texture();
 ledger.mark(texture);assert.equal(ledger.has(texture),true);
 texture.dispose();assert.equal(ledger.has(texture),false);
 assert.equal(ledger.stats().disposalInvalidations,1);
 ledger.mark(texture);assert.equal(ledger.has(texture),true);
 texture.dispose();assert.equal(ledger.stats().disposalInvalidations,2,
  'Attach only one disposal listener per texture');
});
test('invalidate and require reupload when image pixels or source version changes',()=>{
 const ledger=createPhiUploadedTextureLedger(),texture=new THREE.Texture();
 ledger.mark(texture);
 texture.needsUpdate=true;
 assert.equal(ledger.has(texture),false);
 assert.equal(ledger.stats().versionInvalidations,1);
 ledger.mark(texture);assert.equal(ledger.has(texture),true);
 texture.source.needsUpdate=true;
 assert.equal(ledger.has(texture),false);
 assert.equal(ledger.stats().versionInvalidations,2);
});
test('a different texture with the same image has not uploaded to this renderer',()=>{
 const ledger=createPhiUploadedTextureLedger(),image={width:24,height:24};
 const first=new THREE.Texture(image),second=new THREE.Texture(image);
 ledger.mark(first);
 assert.equal(ledger.has(first),true);
 assert.equal(ledger.has(second),false);
});
