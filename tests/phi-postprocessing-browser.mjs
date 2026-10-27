import {chromium} from 'playwright';
import {build} from 'esbuild';
import assert from 'node:assert/strict';

// Deterministic WebGL correctness check; software timings are not GPU benchmarks.
const bundle=await build({stdin:{contents:`
 import * as THREE from 'three';
 import {createPhiPostTest} from './test/virtual-gallery/phi-postprocessing.mjs';
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.08;
 document.body.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e4da');
 const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.07,210);camera.position.set(0,1.6,5);camera.lookAt(0,1,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x888888,2));
 const floor=new THREE.Mesh(new THREE.BoxGeometry(8,.1,8),new THREE.MeshStandardMaterial({color:'#b6b6b6'}));scene.add(floor);
 const block=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial({color:'#ad7957'}));block.position.set(-1.2,1,0);scene.add(block);
 const painting=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.2),new THREE.MeshBasicMaterial({color:'#4e9bca'}));painting.position.set(1,1.2,0);scene.add(painting);
 const presentation=createPhiPostTest({THREE,renderer,scene,camera});await presentation.warm();
 presentation.render();window.__testPixels=()=>{presentation.render();const context=renderer.getContext();const bytes=new Uint8Array(4);const point=painting.position.clone().project(camera);context.readPixels(Math.floor((point.x*.5+.5)*innerWidth),Math.floor((point.y*.5+.5)*innerHeight),1,1,context.RGBA,context.UNSIGNED_BYTE,bytes);return [...bytes];};
 `,resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',write:false,platform:'browser'});
const browser=await chromium.launch({headless:true,executablePath:process.env.PHI_TEST_CHROME||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('https://post-test.invalid/**',route=>route.fulfill({contentType:'text/html',body:`<body style="margin:0"><script type="module">${bundle.outputFiles[0].text}</script></body>`}));
 const pixels={};
 for(const mode of ['off','composer','ao','fxaa','ao-fxaa']){
  await page.goto('https://post-test.invalid/?post='+mode);
  await page.waitForFunction(()=>window.__phiPostTest?.ready);
  const state=await page.evaluate(()=>({stats:window.__phiPostTest,pixel:window.__testPixels()}));
  assert.equal(state.stats.error,null);pixels[mode]=state.pixel;
  console.log(mode,JSON.stringify({warmMs:state.stats.warmMs,pixel:state.pixel}));
 }
 assert.deepEqual(errors,[]);
 for(const mode of ['composer','ao'])for(let i=0;i<3;i++)assert.ok(Math.abs(pixels.off[i]-pixels[mode][i])<=2,'Painting colour changed: '+mode);
 console.log('PASS: all modes render without shader errors; protected painting matches baseline within 2/255.');
}finally{await browser.close();}
