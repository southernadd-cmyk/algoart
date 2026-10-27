import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/gallery/visit/?receptionHeroTest=1&svg-export=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('#enter').waitFor({state:'visible',timeout:45000});
 await page.waitForFunction(()=>!document.querySelector('#enter')?.disabled,{timeout:65000});
 await page.locator('#enter').click();
 await page.waitForFunction(()=>window.__phiReceptionHeroTest?.loaded===true,{timeout:65000});
 const before=await page.evaluate(()=>{
  const x=window.__PP_EXPORT_SCENE__;
  if(!x)throw Error('Missing scene diagnostic');
  const statue=x.scene.getObjectByName('phi-reception-growth-systems-baked-test');
  if(!statue)throw Error('Baked sculpture missing from scene');
  return {x:x.rig.position.x,z:x.rig.position.z,children:statue.children.length};
 });
 await page.keyboard.down('w');
 await page.waitForTimeout(1700);
 await page.keyboard.up('w');
 const after=await page.evaluate(()=>({x:window.__PP_EXPORT_SCENE__.rig.position.x,z:window.__PP_EXPORT_SCENE__.rig.position.z}));
 const moved=Math.hypot(after.x-before.x,after.z-before.z);
 if(moved<.15)throw Error('WASD movement regression: only '+moved+' metres');
 if(errors.length)console.warn('Browser page errors:',errors.slice(0,5));
 console.log('PASS: baked sculpture attached, move distance',moved.toFixed(2),'m');
}finally{await browser.close();}
