import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolveTurnBudget,FIBONACCI_TURNS} from '../confluence/composition.js';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
test('Fibonacci total turns never exceed actual artist capacity',()=>{
 assert.deepEqual(FIBONACCI_TURNS.slice(0,7),[5,8,13,21,34,55,89]);
 assert.equal(resolveTurnBudget(45,55).count,34);
 assert.equal(resolveTurnBudget(89,55).count,55);
 assert.equal(resolveTurnBudget(13,13).count,13);
 assert.equal(resolveTurnBudget(7,55).count,5);
 assert.throws(()=>resolveTurnBudget(4,5));
});
test('Confluence renders a portrait/landscape choice and keeps Step as a single advance',()=>{
 const page=read('../confluence/index.html');
 const ui=read('../confluence/ui.js');
 const css=read('../confluence/style.css');
 assert.match(page,/format-portrait/);
 assert.match(page,/format-landscape/);
 assert.match(page,/id="total-turns"/);
 assert.match(ui,/advance\(\);/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/overflow:hidden/);
 assert.doesNotMatch(page,/A SHARED DRAWING EXPERIMENT|Several systems, one sheet/);
 assert.match(page,/class="side-wordmark"/);
});
test('social links use Confluence-specific preview storage',()=>{
 const page=read('../confluence/index.html');
 const share=read('../confluence/share-study.js');
 assert.match(page,/id="share-x"/);
 assert.match(page,/id="share-threads"/);
 assert.match(page,/id="share-bluesky"/);
 assert.match(share,/confluence\/preload/);
 assert.match(share,/window\.open/);
});

test('Confluence page must wire portrait controls and fit its canvas, not just show buttons',()=>{
 const page=read('../confluence/index.html');
 const ui=read('../confluence/ui.js');
 assert.ok(ui.includes("byId('format-' + format).addEventListener('click'"), 'Format buttons require JS event listeners');
 assert.ok(ui.includes('orientation.value = format'), 'Format buttons must set portrait or landscape');
 assert.ok(ui.includes('syncFormatButtons()'), 'Format pressed state must be synchronized');
 assert.ok(ui.includes("totalTurns.addEventListener('change', () => {") &&
   ui.includes('preferredTurns=Number(totalTurns.value)||55;') &&
   ui.includes('build();'), 'Fibonacci choices must redraw and remember requested turns');
 assert.ok(ui.includes('new ResizeObserver(() => fitCanvas())'), 'Canvas must fit available viewport');
 assert.ok(ui.includes('state.study.sheet.width / state.study.sheet.height'), 'Aspect ratio must come from study');
 assert.ok(ui.includes("figure.style.width = fitted + 'px'"), 'Viewport must constrain figure width');
 assert.ok(page.includes('src="ui.js?v=confluence-'), 'Browser must receive versioned Confluence UI script');
});

test('Compare captions identify each artist, material and turn share',()=>{
 const ui=read('../confluence/ui.js');
 const css=read('../confluence/style.css');
 assert.match(ui,/function renderTurnLegend\(/);
 assert.match(ui,/renderTurnLegend\('shared-turns',state\.study\.primary\.counts,state\.study\.roster\)/);
 assert.match(ui,/renderTurnLegend\('equal-turns',state\.study\.equal\.counts,state\.study\.roster\)/);
 assert.match(ui,/artist\.inks\?\.length\?artist\.inks:\[artist\.ink\]/);
 assert.match(ui,/Math\.min\(5,inks\.length\)/);
 assert.match(ui,/palette\.append\(swatch\)/);
 assert.match(css,/\.turn-artist-palette/);
 assert.match(css,/#shared-turns,#equal-turns/);
});

test('Both captions show the exact seed so screenshots remain reproducible',()=>{
 const page=read('../confluence/index.html');
 const ui=read('../confluence/ui.js');
 assert.match(page,/id="shared-seed"/);
 assert.match(page,/id="equal-seed"/);
 assert.match(ui,/byId\('shared-seed'\)\.textContent='Seed '\+studySeed/);
 assert.match(ui,/byId\('equal-seed'\)\.textContent='Seed '\+studySeed/);
});

test('Confluence makes response choices algorithmically rather than via a dropdown',()=>{
 const page=read('../confluence/index.html');
 const ui=read('../confluence/ui.js');
 const collab=read('../confluence/collab.js');
 assert.doesNotMatch(page,/id="response"/);
 assert.doesNotMatch(page,/Weave around marks|Echo nearby directions|Leave more space/);
 assert.doesNotMatch(ui,/response\.value|updateResponseHint/);
 assert.match(collab,/inferResponse\(/);
 assert.match(ui,/action\.reaction/);
});

test('Rotate lead is an active control and share links retain the selected hand',()=>{
 const ui=read('../confluence/ui.js');
 const html=read('../confluence/index.html');
 const share=read('../confluence/share-study.js');
 assert.match(html,/id="rotate-lead"/);
 assert.match(html,/<span id="counter"[^>]*>[^<]*<\/span>\s*<button type="button" id="rotate-lead-toolbar"/);
 assert.match(html,/id="toolbar-lead-label"/);
 assert.match(ui,/byId\('rotate-lead-toolbar'\)\.addEventListener\('click',rotateLead\)/);
 assert.match(ui,/byId\('rotate-lead'\)\.addEventListener\('click',rotateLead\)/);
 assert.match(ui,/byId\('toolbar-lead-label'\)\.textContent='A'\+\(lead\+1\)/);
 assert.match(html,/id="lead-index"/);
 assert.match(ui,/byId\('rotate-lead'\)\.addEventListener\('click'/);
 assert.match(ui,/leadInput\.value=String\(\(Number\(leadInput\.value\)\+1\)%3\)/);
 assert.match(ui,/renderTurnLegend\('equal-turns'/);
 assert.match(ui,/leadIndex:Number\(leadInput\.value\)/);
 assert.match(share,/data\.leadIndex\?\?0/);
 assert.match(share,/data\.leadIndex>=0 && data\.leadIndex<=2/);
});

import {importLeadFromURL} from '../confluence/import-lead.js';
import {defaultSettings} from '../confluence/artist-controls.js';

test('Confluence public navigation and approved solo-editor handoff are both available',()=>{
 const destinations=[
  ['../index.html','href="confluence/"'],
  ['../gallery/index.html','href="../confluence/"'],
  ['../about/index.html','href="../confluence/"'],
  ['../about/step-by-step/index.html','href="../../confluence/"'],
  ['../confluence/index.html','href="./" aria-current="page">confluence</a>']
 ];
 for(const [path,expected] of destinations){
   const page=read(path);
   assert(page.includes(expected),'Missing Confluence nav entry in '+path);
   assert.equal((page.match(/data-algo-nav/g)||[]).length,4,
     'Header must contain exactly four nav destinations: '+path);
 }
 const root=read('../index.html'),app=read('../js/app.js');
 assert.match(root,/id="exploreConfluence"/);
 assert.match(root,/Explore in Confluence/);
 assert.match(app,/if\(confluence\)/,
   'Dormant optional link handling must not break the solo editor');
 assert.match(app,/var confluence=\$\('exploreConfluence'\)/);
 assert.match(app,/var shared=new URL\('confluence\/',location.href\)/);
 assert.match(app,/shared\.search=params/);
 assert.doesNotMatch(root,/Draw with others|Three Hands/);
 const about=read('../about/index.html');
 assert.match(about,/Three procedural artists/);
 assert.match(about,/not other visitors/);
 assert.match(about,/not automatically added to the daily gallery/);
});

test('Solo-to-Confluence importer preserves full-state settings for all five current materials',()=>{
 const catalog={
   systems:['organic','field','rects'].map(id=>({id})),
   palettes:{warm:'Warm',spectrum:'Full Spectrum'},
   materials:{marker:'Marker',tissue:'Tissue',watercolour:'Watercolour',
     oil:'Oil',action:'Action'}
 };
 const materials=['marker','tissue-v8','watercolour-v2s','oil-v8','action-v4'];
 for(const material of materials){
   const lead={id:1,system:'field',palette:'spectrum',material:'marker',
     settings:defaultSettings({pen:'felt',width:8})};
   const inputs={seed:{value:''},orientation:{value:'landscape'},
     paper:{value:'#f5f0e6'},grain:{value:'0'}};
   const params=new URLSearchParams({
     v:'10',seed:'CONFLUENCE-SOURCE-2026',mode:'organic',pal:'warm',
     material,fmt:'portrait',paper:'#e6d5cc',grain:'27',
     el:'58',den:'63',cx:'41',neg:'72',phi:'38.2',rec:'5',
     spi:'61',ga:'84',nest:'22',th:'17',wob:'29',od:'4',
     op:'57',pr:'48',dry:'32',curve:'39',shape:'64',overlap:'52',
     rot:'87',cols:'12',sat:'73',bri:'52',pen:'broad',
     ln:'0',ci:'1',re:'0',po:'1',ar:'0',sheet:'phi'
   });
   assert.equal(importLeadFromURL(params,lead,inputs,catalog),true);
   assert.equal(lead.material,material==='tissue-v8'?'tissue':
     material.startsWith('watercolour')?'watercolour':
     material.split('-')[0]);
   assert.equal(lead.system,'organic');
   assert.equal(lead.palette,'warm');
   assert.equal(lead.settings.seed,'CONFLUENCE-SOURCE-2026');
   assert.equal(lead.settings.colourCount,12);
   assert.equal(lead.settings.elements,58);
   assert.equal(lead.settings.negativeSpace,72);
   assert.equal(lead.settings.thickness,17);
   assert.equal(lead.settings.phiStrength,38.2);
   assert.equal(lead.settings.fit,true);
   assert.equal(lead.settings.lines,false);
   assert.equal(lead.settings.circles,true);
   assert.equal(lead.settings.rectangles,false);
   assert.equal(inputs.orientation.value,'portrait');
   assert.equal(inputs.paper.value,'#e6d5cc');
   assert.equal(Number(inputs.grain.value),27);
 }
});
