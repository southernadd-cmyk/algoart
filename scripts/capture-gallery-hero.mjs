// Photograph the ACTUAL deployed Three.js gallery from the reference plaza viewpoint.
// This script changes no tower geometry, archive data, R2 configuration or publishing workflow.
import {chromium} from 'playwright';
import {stat} from 'node:fs/promises';

const target='gallery/visit/walk-the-tower-golden.png';
const site='https://southernadd-cmyk.github.io/algoart/gallery/visit/?debug=1&svg-export=1';
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
let page;
try {
  page=await browser.newPage({viewport:{width:1595,height:986},deviceScaleFactor:1});
  page.setDefaultTimeout(20000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(
    ()=>!document.querySelector('#enter')?.disabled||!!window.__galleryStartupError,
    null,{timeout:210000}
  );
  const startup=await page.evaluate(()=>window.__galleryStartupError||'');
  if(startup)throw new Error('Live tower failed to start: '+startup);
  await page.locator('#enter').evaluate(element=>element.click());
  await page.waitForFunction(
    ()=>document.querySelector('#welcome')?.hidden&&window.__phiFullEngine?.roomCount>0,
    null,{timeout:90000}
  );
  await page.waitForFunction(
    ()=>window.__PP_EXPORT_SCENE__?.scene?.getObjectByName('phi-tagged-square'),
    null,{timeout:45000}
  );
  await page.waitForTimeout(1900);
  // The old reference is shot from a low position near the far side of the
  // reflecting pool. The square's local +z axis points out from the entrance.
  const targetPose=await page.evaluate(()=>{
    const exportScene=window.__PP_EXPORT_SCENE__;
    const {scene,camera,rig,THREE}=exportScene;
    const square=scene.getObjectByName('phi-tagged-square');
    if(!square||!camera||!rig)throw Error('Expected live plaza camera not available');
    square.updateWorldMatrix(true,false);
    const stand=square.localToWorld(new THREE.Vector3(-7,0,29));
    const focus=square.localToWorld(new THREE.Vector3(3,17,0));
    rig.position.copy(stand);
    camera.position.set(0,1.68,0);
    const dx=focus.x-stand.x,dy=focus.y-(stand.y+1.68),dz=focus.z-stand.z;
    const yaw=Math.atan2(-dx,-dz);
    const pitch=Math.atan2(dy,Math.hypot(dx,dz));
    document.querySelector('#world')?.focus({preventScroll:true});
    return {yaw,pitch};
  });
  // Lock the document camera for photography. The live navigation tick keeps
  // its own yaw/pitch state and would otherwise immediately override an
  // externally set view; changing only this temporary browser camera is safe.
  await page.evaluate(({yaw,pitch})=>{
    const {rig,camera}=window.__PP_EXPORT_SCENE__;
    rig.rotation.y=yaw;
    camera.rotation.x=pitch;
    for(const [euler,axis,angle] of [[rig.rotation,'y',yaw],[camera.rotation,'x',pitch]]){
      Object.defineProperty(euler,axis,{configurable:true,enumerable:true,
        get(){return angle;},set(){}});
    }
  },targetPose);
  await page.waitForTimeout(800);
  const composition=await page.evaluate(()=>{
    const x=window.__PP_EXPORT_SCENE__,square=x.scene.getObjectByName('phi-tagged-square');
    x.rig.updateWorldMatrix(true,true);
    square.updateWorldMatrix(true,false);
    x.camera.updateMatrixWorld(true);
    const project=(a,b,c)=>{
      const p=square.localToWorld(new x.THREE.Vector3(a,b,c)).project(x.camera);
      return {x:+((p.x+1)/2).toFixed(3),y:+((1-p.y)/2).toFixed(3)};
    };
    return {door:project(0,1.8,0),pool:project(3,0,18),
      camera:{x:x.rig.position.x,y:x.rig.position.y,z:x.rig.position.z},
      pitch:x.camera.rotation.x,yaw:x.rig.rotation.y,roomCount:window.__phiFullEngine?.roomCount};
  });
  console.log('GALLERY_HERO_CAMERA '+JSON.stringify(composition));
  const {door,pool}=composition;
  // Reject accidental aerial, indoor or wrong-way views rather than publishing
  // an unrelated image over the homepage photograph.
  if(!(door.x>.32&&door.x<.62&&door.y>.60&&door.y<.99&&
       pool.x>.51&&pool.x<.93&&pool.y>.64&&pool.y<1.14))
    throw Error('Reference camera composition check failed: '+JSON.stringify(composition));
  if(!composition.roomCount)throw Error('Tower geometry was not built');
  await page.addStyleTag({content:
    'body > *:not(#world){visibility:hidden!important} #world{visibility:visible!important}'
  });
  await page.waitForTimeout(700);
  const result=await page.screenshot({path:target,type:'png',animations:'disabled',timeout:90000});
  if(result.byteLength<110000||(await stat(target)).size<110000)
    throw Error('Captured image too small to be a real architectural view');
  console.log('GALLERY_HERO_CAPTURED '+target+' '+result.byteLength+' bytes; page errors: '+JSON.stringify(errors.slice(0,6)));
}finally{
  await page?.close().catch(()=>{});
  await browser.close();
}
