import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const generator=readFileSync(new URL('../js/generator.js',import.meta.url),'utf8');
const help=readFileSync(new URL('../js/control-help.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ids={mode:{value:'field'}};
for(const m of html.matchAll(/<input id="([^"]+)" type="range" min="([^"]+)" max="([^"]+)" value="([^"]+)"/g)){
  const [,id,min,max,value]=m;
  ids[id]={id,min:+min,max:+max,value:+value,step:1,listeners:{},
    parentElement:{querySelector:()=>({})},
    addEventListener(event,fn){this.listeners[event]=fn}};
}
const document={getElementById:id=>ids[id],querySelectorAll:()=>Object.values(ids).filter(x=>x.listeners)};
const A={};
const start=help.indexOf('var RANGE_LIMITS='),end=help.indexOf('\nvar entries=',start);
assert(start>=0&&end>start,'Locate actual UI range implementation');
const api=new Function('A','document',help.slice(start,end)+';return {RANGE_LIMITS,rangeStates,displayRange};')(A,document);
const styleNames={rects:'rectStyle',organic:'organic',geometric:'geometric',scribble:'style'};
for(const [mode,controls] of Object.entries(api.RANGE_LIMITS)){
  const styleName=styleNames[mode];
  const pattern=new RegExp('var '+styleName+'=Object\\.assign\\(\\{\\},s,\\{([\\s\\S]*?)\\n  \\}\\);');
  const functionNames={rects:'drawRects',organic:'drawOrganic',geometric:'drawGeometric',scribble:'drawScribble'};
  const block=generator.slice(generator.indexOf('function '+functionNames[mode]+'(')).match(pattern);
  assert(block,'Locate renderer style for '+mode);
  ids.mode.value=mode;
  for(const [id,[min,max]] of Object.entries(controls)){
    const expression=block[1].match(new RegExp('\\b'+id+':([^\\n]+)'));
    assert(expression,'Locate renderer expression '+mode+'/'+id);
    const renderer=new Function('s','return '+expression[1].replace(/,$/,''));
    assert.equal(renderer({[id]:api.rangeStates[id].min}),min,mode+'/'+id+' minimum must match renderer');
    assert.equal(renderer({[id]:api.rangeStates[id].max}),max,mode+'/'+id+' maximum must match renderer');
    for(let raw=api.rangeStates[id].min;raw<=api.rangeStates[id].max;raw++){
      A.setControlValue(ids[id],raw);
      assert.equal(+ids[id].value,renderer({[id]:raw}),mode+'/'+id+' effective value');
      assert.equal(A.readControlValue(ids[id]),raw,'Original seed parameter retained');
    }
  }
}
const expression=generator.slice(generator.indexOf('function drawGeometric')).match(/var count=([^;]*);/);
assert(expression,'Locate actual constructed-form count');
const formCount=new Function('s','return '+expression[1]);
ids.mode.value='geometric';
for(let detail=0;detail<=100;detail++){
  A.setControlValue(ids.complexity,detail);
  api.displayRange(ids.elements,api.rangeStates.elements);
  for(let raw=8;raw<=140;raw++){
    A.setControlValue(ids.elements,raw);
    assert.equal(+ids.elements.value,formCount({elements:raw,complexity:detail}));
    assert.equal(A.readControlValue(ids.elements),raw);
  }
  for(let count=+ids.elements.min;count<=+ids.elements.max;count++){
    ids.elements.value=count;ids.elements.listeners.input();
    assert.equal(formCount({elements:A.readControlValue(ids.elements),complexity:detail}),count);
  }
}
console.log('PASS: all per-system slider bounds/effective values and calculated form counts agree with renderer expressions; raw artwork settings are retained.');
