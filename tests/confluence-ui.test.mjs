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
 assert.match(ui,/artist\.inks\?\.\[0\]/);
 assert.match(css,/#shared-turns,#equal-turns/);
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
