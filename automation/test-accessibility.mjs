import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4173/';
const MODES={field:'Orbital Studies',spiral:'Golden Trajectories',rects:'Recursive Divisions',burst:'Radiant Systems',network:'Connected Fields',organic:'Growth Systems',geometric:'Constructed Forms',scribble:'Automatic Marks'};
function assert(c,m){if(!c)throw new Error(m)}
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{name:'desktop',width:1440,height:950},{name:'mobile',width:390,height:844}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.addInitScript(()=>localStorage.setItem('algoart-intro-seen','1'));
    for(const [mode,series] of Object.entries(MODES)){
      const seed='A11Y-'+mode.toUpperCase()+'-001';
      await page.goto(BASE+'?v=6&mode='+encodeURIComponent(mode)+'&seed='+encodeURIComponent(seed)+'&phi=92',{waitUntil:'networkidle'});
      const canvas=page.locator('#art'); await canvas.waitFor({state:'visible'});
      const role=await canvas.getAttribute('role'),alt=await canvas.getAttribute('aria-label');
      assert(role==='img',viewport.name+' '+mode+': missing img role');
      assert(alt&&alt.includes(series),viewport.name+' '+mode+': missing series');
      assert(alt.length>80&&alt.length<500,viewport.name+' '+mode+': bad alt length '+(alt||'').length);
      assert(await page.locator('#save').count()===0,viewport.name+' '+mode+': toolbar save remains');
      assert(await page.locator('#savePanel').count()===1,viewport.name+' '+mode+': export PNG missing');
      assert(await page.locator('#saveSVG').count()===1,viewport.name+' '+mode+': export SVG missing');
      await page.locator('#describe').click();
      const overlay=page.locator('#descriptionOverlay');
      assert(await overlay.isVisible(),viewport.name+' '+mode+': Describe did not open');
      const panelAlt=(await page.locator('#descriptionAlt').textContent())||'';
      const visual=(await page.locator('#descriptionLong').textContent())||'';
      const construction=(await page.locator('#descriptionConstruction').textContent())||'';
      assert(panelAlt===alt,viewport.name+' '+mode+': panel/canvas alt mismatch');
      assert(visual.length>80,viewport.name+' '+mode+': visual description too short');
      assert(construction.includes('construction metadata'),viewport.name+' '+mode+': provenance missing');
      if(viewport.name==='mobile'){
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
        assert(overflow<=1,'mobile '+mode+': horizontal overflow '+overflow+'px');
      }
      await page.locator('#closeDescription').click();
      assert(!(await overlay.isVisible()),viewport.name+' '+mode+': Describe did not close');
      await page.locator('#geometry').click();
      assert(await page.locator('.canvas-wrap').evaluate(el=>el.classList.contains('reveal-active')),viewport.name+' '+mode+': Reveal failed');
      await page.locator('#geometry').click();
      const before=alt;
      await page.reload({waitUntil:'networkidle'});
      const after=await page.locator('#art').getAttribute('aria-label');
      assert(before===after,viewport.name+' '+mode+': description not deterministic');
    }
    await page.goto(BASE+'?v=5&mode=spiral&seed=A11Y-LEGACY-V5&phi=90',{waitUntil:'networkidle'});
    const legacy=page.locator('#rendererChip');
    assert(await legacy.isVisible(),viewport.name+': V5 chip not visible');
    assert(((await legacy.textContent())||'').includes('V5'),viewport.name+': legacy chip incorrect');
    await page.locator('#describe').click();
    assert(((await page.locator('#descriptionAlt').textContent())||'').includes('Golden Trajectories'),viewport.name+': V5 Describe failed');
    await page.close();
  }
  console.log('Accessibility UI regression passed: 8 systems × desktop/mobile + V5 legacy.');
}finally{await browser.close()}
