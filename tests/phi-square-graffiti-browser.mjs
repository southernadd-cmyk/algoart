// Render the actual baked wall material at walking distance, on both sides and
// both power profiles. A screenshot alone would miss buried transparent layers.
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const server=http.createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/gallery/visit/__graffiti-check__'){res.setHeader('Content-Type','text/html');res.end('<canvas></canvas>');return;}
 try{const file=path.join(root,pathname);const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html');res.end(data);}
 catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const variant of ['live','test'])for(const lowPower of [false,true]){
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/gallery/visit/__graffiti-check__');
  const result=await page.evaluate(async({variant,lowPower})=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   globalThis.__phiReceptionTestRefresh=variant==='test';
   const [{createPhiSquare,planPhiSquare,planSquareTags},{planSquareWallAtlases}]=await Promise.all([
    import('/gallery/visit/phi-square-graffiti.mjs'),import('/gallery/visit/square-graffiti-atlas.mjs')]);
   const canvas=document.querySelector('canvas');
   const renderer=new THREE.WebGLRenderer({canvas,antialias:false});renderer.setSize(96,96);renderer.setClearColor('#201b18');
   const map=new THREE.DataTexture(new Uint8Array([160,120,90,255]),1,1);map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
   const brick=new THREE.MeshStandardMaterial({color:'#9d7255',map,roughness:1});brick.userData.tileMeters=2;
   const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0xffffff,3));
   const square=createPhiSquare(THREE,{brick,concrete:brick,lowPower});
   const {root}=square.addTo(scene,{doorway:{x:0,z:0},outward:{x:0,z:1}});
   const deadline=performance.now()+30000;
   while(square.diagnostics().pending&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
   if(square.diagnostics().pending)throw Error('Baked wall atlases did not load: '+JSON.stringify(square.diagnostics()));
   const groups=root.children.filter(c=>c.name==='tower-exterior-graffiti');
   const objects=planPhiSquare(),marks=planSquareTags(objects);
   const plans=planSquareWallAtlases(marks.filter(m=>m.material==='brick'),{lowPower});
   const target=new THREE.WebGLRenderTarget(96,96),painted=new Uint8Array(96*96*4),plain=new Uint8Array(painted.length);
   const camera=new THREE.PerspectiveCamera(50,1,.02,100);
   const checks=[];
   // Front and back of a rotated brick wall, using a fully painted pixel as
   // the target so an empty hole in a phi cannot give a false disappearance.
   for(const side of [0,1]){
    const faceId=objects.find(o=>o.material==='brick').id+':'+side;
    const pageIndex=plans.findIndex(p=>p.entries.some(e=>e.mark.face.id===faceId));
    const e=plans[pageIndex].entries.find(e=>e.mark.face.id===faceId),m=e.mark;
    const texture=groups[0].children[pageIndex].material.map.image;
    const pixels=texture.getContext('2d').getImageData(0,0,texture.width,texture.height).data;
    let px=0,py=0,found=false;
    for(let y=Math.ceil(e.y);y<e.y+e.height&&!found;y++)for(let x=Math.ceil(e.x);x<e.x+e.width;x++)if(pixels[(y*texture.width+x)*4+3]>180){px=x;py=y;found=true;break;}
    if(!found)throw Error('Wall bake has no paint');
    const u=(px-e.x)/e.width-.5,n=new THREE.Vector3(m.normal.x,0,m.normal.z);
    const aim=new THREE.Vector3(m.face.centre.x+n.z*u*m.width,(1-(py-e.y)/e.height)*m.height,m.face.centre.z-n.x*u*m.width);
    for(const distance of [.38,.75,2,8]){
     camera.position.copy(aim).addScaledVector(n,distance);camera.lookAt(aim);
     renderer.setRenderTarget(target);for(const g of groups)g.visible=true;
     renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,96,96,painted);
     for(const g of groups)g.visible=false;
     renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,96,96,plain);
     let changed=0;for(let i=0;i<plain.length;i+=4)if(Math.abs(painted[i]-plain[i])+Math.abs(painted[i+1]-plain[i+1])+Math.abs(painted[i+2]-plain[i+2])>12)changed++;
     if(changed<4)throw Error('Paint disappeared '+JSON.stringify({variant,lowPower,side,distance,changed}));
     checks.push({side,distance,changed});
    }
   }
   return {variant,lowPower,checks,diagnostics:square.diagnostics()};
  },{variant,lowPower});
  assert.equal(result.diagnostics.pending,0);assert.equal(result.diagnostics.painted,187);assert.deepEqual(result.diagnostics.errors,[]);
  console.log(JSON.stringify(result));await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
