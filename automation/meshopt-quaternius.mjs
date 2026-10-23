// Apply only Meshopt, without the CLI's automatic prune/reorder steps.
// Keep all skin nodes and named bones used by the gallery pose system.
import {NodeIO} from '@gltf-transform/core';
import {EXTMeshoptCompression, KHRMeshQuantization} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import {join} from 'node:path';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions([EXTMeshoptCompression,KHRMeshQuantization])
  .registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const dir='test/virtual-gallery/models';
for(const sex of ['male','female']){
 const model=await io.read(join(dir,`quaternius-${sex}-flat.glb`));
 await model.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
 await io.write(join(dir,`quaternius-${sex}-meshopt.glb`),model);
 console.log('Preserved full rig',sex);
}
