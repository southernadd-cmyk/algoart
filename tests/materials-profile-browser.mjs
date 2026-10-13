// Material-aware source profile copy; the artwork URL and renderer remain unchanged.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1200,height:900}});
await context.addInitScript(()=>{
  localStorage.setItem('algoart-intro-seen','1');
  localStorage.setItem('algoart-ethos-seen','1');
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
function snapshot(){
  return page.evaluate(()=>{
    const A=window.AlgoArt,select=document.querySelector('#pen');
    const names={};
    for(const id of ['pen','thickness','wobble','overdraw','opacity','pressure','dryness']){
      const input=document.getElementById(id);
      names[id]={
        label:document.querySelector('label[for="'+id+'"]')?.textContent,
        tooltip:document.getElementById('control-help-'+id)?.textContent,
        value:input.value
      };
    }
    return {version:A.rendererVersion,settings:A.readSettings(),
      options:Array.from(select.options,o=>({value:o.value,text:o.textContent,selected:o.selected})),
      names,note:document.getElementById('materialControlsNote').textContent};
  });
}
try{
  const url=new URL(root);url.search='?v=9&seed=PROFILE-NAMES-001&mode=network&pen=highlighter&tissue=6&paper=%23dbcab1';
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent.includes('PROFILE-NAMES-001'));
  const tissue=await snapshot();
  assert.equal(tissue.settings.pen,'highlighter');
  assert.equal(tissue.names.pen.label,'Source mark profile');
  assert.equal(tissue.options.find(x=>x.value==='highlighter').text,'Flat-edged bands');
  assert.equal(tissue.options.find(x=>x.value==='highlighter').selected,true);
  assert.equal(tissue.options.length,7);
  assert(!tissue.options.some(x=>/Highlighter|Marker|Felt Tip|Pen/.test(x.text)));
  assert.match(tissue.note,/not physical brushes or highlighters/);
  assert.match(tissue.names.pen.tooltip,/not literal pens or watercolour brushes/);
  assert.equal(tissue.names.overdraw.label,'Source repetitions');
  assert.equal(tissue.names.pressure.label,'Width variation');
  assert.match(tissue.names.opacity.tooltip,/own pigment translucency/);
  assert.equal(tissue.settings.paper,'#dbcab1');

  await page.locator('#materialStyle').selectOption('marker');
  const marker=await snapshot();
  assert.equal(marker.names.pen.label,'Mark-making tool');
  assert.equal(marker.options.find(x=>x.value==='highlighter').text,'Highlighter');
  assert.equal(marker.options.find(x=>x.value==='highlighter').selected,true);
  assert.equal(marker.names.overdraw.label,'Repeat passes');
  assert.equal(marker.names.pressure.label,'Stroke pressure');
  assert.match(marker.note,/Marker tools control the visible ink strokes/);
  assert.deepEqual(marker.settings,tissue.settings,
    'Material switch must not touch any drawing parameter');
  assert.equal(marker.version,tissue.version);
  assert.equal(new URL(page.url()).searchParams.get('paper'),'#dbcab1');

  await page.locator('#materialStyle').selectOption('tissue');
  const restored=await snapshot();
  assert.deepEqual(restored.settings,tissue.settings);
  assert.deepEqual(restored.options,tissue.options);
  assert.equal(restored.names.pen.label,tissue.names.pen.label);

  // A different profile remains a stable serialized pen ID in both materials.
  await page.locator('#pen').selectOption('paint');
  assert.equal(new URL(page.url()).searchParams.get('pen'),'paint');
  assert.equal((await snapshot()).options.find(x=>x.value==='paint').text,'Dense marks');
  await page.locator('#materialStyle').selectOption('marker');
  assert.equal((await snapshot()).options.find(x=>x.value==='paint').text,'Paint Pen');

  // Historical links: labels may adapt, but no old renderer is silently upgraded.
  const historic=new URL(root);
  historic.search='?v=8&tissue=6&seed=HISTORIC-PROFILE&mode=rects&pen=highlighter';
  await page.goto(historic.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#statsText')?.textContent.includes('HISTORIC-PROFILE'));
  assert.equal((await snapshot()).version,8);
  assert.equal((await snapshot()).options.find(x=>x.value==='highlighter').text,'Flat-edged bands');
  await page.locator('#materialStyle').selectOption('marker');
  assert.equal((await snapshot()).version,8);
  assert.equal((await snapshot()).settings.pen,'highlighter');
  assert.deepEqual(errors,[]);
  console.log('PASS: all seven material-aware source profiles, accessible names/help, shared settings, stable URL IDs, V8 links');
}finally{
  await browser.close();
}
