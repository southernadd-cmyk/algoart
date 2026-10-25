import test from 'node:test';
import assert from 'node:assert/strict';
import {boundaryDistance,rasterThrowup} from './throwup-paint.mjs';
import {createTag,REFERENCE_STUDIES,LETTERING_FORMS,letterSkeleton,goldenMetrics} from './tag-engine.mjs';
import {shapeStudyLetter} from './handstyles.mjs?v=bold-dialects-v5';
const width=128,height=96,mask=new Uint8Array(width*height);
for(let y=20;y<76;y++)for(let x=30;x<98;x++)mask[y*width+x]=255;
const pixel=(data,x,y)=>[...data.slice((y*width+x)*4,(y*width+x)*4+4)];
test('paint follows a single broad contour and leaves a hollow interior clear',()=>{
 const distance=boundaryDistance(mask,width,height);
 assert.equal(distance[48*width+29],.5);assert.equal(distance[48*width+30],-.5);
 assert.ok(distance[48*width+64]<-20);assert.ok(distance[48*width+10]>15);
 const painted=rasterThrowup({mask,width,height,hollow:true,outline:6.8,seed:'contour-proof'});
 assert.equal(pixel(painted,64,48)[3],0);assert.equal(pixel(painted,5,48)[3],0);
 let runs=0,inPaint=false,coverage=0;
 for(let x=15;x<48;x++){const on=pixel(painted,x,48)[3]>50;if(on&&!inPaint)runs++;inPaint=on;if(on)coverage++;}
 assert.equal(runs,1);assert.ok(coverage>=10);
});
test('fill is matte paint without an inset highlight, and deposits are seed stable',()=>{
 const options={mask,width,height,seed:'paint-proof',ink:'#242a28',fill:'#b6a4c0'};
 const a=rasterThrowup(options),b=rasterThrowup({...options,mask:mask.slice()}),c=rasterThrowup({...options,seed:'another'});
 assert.deepEqual(a,b);assert.notDeepEqual(a,c);
 const centre=pixel(a,64,48);assert.ok(centre[3]>210);assert.ok(centre[0]>175&&centre[0]<190);
 const inside=[];
 for(let y=35;y<60;y++)for(let x=48;x<78;x++){const p=pixel(a,x,y);inside.push(p[3]);assert.ok(p[0]<=185&&p[1]<=167&&p[2]<=195);}
 assert.ok(new Set(inside).size>8);
 const hollow=rasterThrowup({...options,hollow:true});assert.equal(pixel(hollow,64,48)[3],0);
 const marker=rasterThrowup({...options,finish:'marker'});assert.notDeepEqual(marker,a);
});
test('filled and hollow lettering keep each reference writer’s actual stroke alphabet',()=>{
 const metrics=goldenMetrics();
 for(const [hand,study] of Object.entries(REFERENCE_STUDIES)){
  for(const form of ['hollow','bubble','straight','blockbuster','piece','pixo','calligraphy']){
   if(study.shape==='oneline'&&!LETTERING_FORMS[form].solid)continue;
   const tag=createTag('ECHO',{form,hand,seed:'alphabet-proof'});
   for(const frame of tag.construction.letters){
    const raw=letterSkeleton(frame.character,{hand:study.family,variant:tag.writer.variants[frame.character],metrics});
    const expected=shapeStudyLetter(frame.character,raw,study,metrics).strokes.length;
    assert.equal(tag.strokes.filter(s=>s.kind==='letter'&&s.letterIndex===frame.index).length,expected,hand+' '+form+' '+frame.character);
   }
  }
 }
 const tall=createTag('ECHO',{form:'bubble',hand:'kadism'}),open=createTag('ECHO',{form:'bubble',hand:'karma'});
 assert.ok(tall.construction.letters[0].stretch>open.construction.letters[0].stretch*1.2);
 assert.notDeepEqual(createTag('ECHO',{form:'bubble',hand:'sicoer'}).strokes,createTag('ECHO',{form:'bubble',hand:'rush'}).strokes);
});
