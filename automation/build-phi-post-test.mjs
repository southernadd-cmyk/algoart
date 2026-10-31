import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Transform only the staging build. The live source and bundle remain unchanged.
export function instrumentPhiSource(source){
 // The live source already owns the approved composer; never double-inject.
 if(source.includes("createPhiPostFX(THREE,renderer,scene,camera"))return source;
 const replace=(before,after)=>{
  if(source.split(before).length!==2)throw new Error('Post-processing integration anchor changed: '+before.slice(0,80));
  source=source.replace(before,after);
 };
 source="import {createPhiPostTest} from '../../test/virtual-gallery/phi-postprocessing.mjs';\n"+source;
 replace('const galleryFinish=createArchitecturalMaterials',
  'const phiPresentation=renderer?createPhiPostTest({THREE,renderer,scene,camera}):null;\nconst galleryFinish=createArchitecturalMaterials');
 replace("if(!$('lift').hidden){renderer.render(scene,camera);return;}",
  "if(!$('lift').hidden){phiPresentation.render();return;}");
 replace('  renderer.render(scene,camera);\n  if(GALLERY_DEBUG)',
  '  phiPresentation.render();\n  if(GALLERY_DEBUG)');
 replace('  renderer.setSize(innerWidth,innerHeight);',
  '  renderer.setSize(innerWidth,innerHeight);\n  phiPresentation?.resize();');
 replace('  const light=new THREE.SpotLight(0xfff3df,12,12,.66,.8,1.5);',
  "  const light=new THREE.SpotLight(0xfff3df,12,12,.66,.8,1.5);light.name='phi-shadow-room-light';");
 replace("  enter.disabled=false;enter.textContent='Enter the gallery';",
  "  phiPresentation?.editionChanged(elevation);\n  if(!viaLift&&!welcome.hidden)await phiPresentation?.warm();\n  enter.disabled=false;enter.textContent='Enter the gallery';");
 return source;
}

if(process.argv[1]===fileURLToPath(import.meta.url))await build({
 entryPoints:['gallery/visit/gallery-phi-test.js'],bundle:true,minify:true,format:'esm',
 // import.meta.url in the existing asset loaders must retain gallery/visit/.
 platform:'browser',target:'es2022',outfile:'gallery/visit/gallery-phi-post-test-bundle.js',
 plugins:[{name:'staging-presentation-only',setup(builder){
  builder.onLoad({filter:/[/\\]gallery-phi\.js$/},async({path})=>({
   contents:instrumentPhiSource(await readFile(path,'utf8')),loader:'js',resolveDir:fileURLToPath(new URL('../gallery/visit/',import.meta.url))
  }));
 }}]
});
