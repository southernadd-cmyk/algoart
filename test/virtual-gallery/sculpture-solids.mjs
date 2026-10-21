// Proportion Piece: solid portrait relief composition, version 2.
// A single portrait becomes an arrangement of independently extruded, tilted
// fragments rather than repeated transparent copies of the entire image.
// Each fragment has a substantial 3-D thickness and its own front-facing
// region of the source artwork. The same seed/engine always yields the same form.
import {makeRandom,seedFromString,INV_PHI,GOLDEN_ANGLE} from './layout-v2.mjs';
import {SCULPTURE_WIDTH,SCULPTURE_HEIGHT,ENGINE_FORMS} from './sculptures.mjs';

export const SOLID_SCULPTURE_VERSION=2;
export const FRAGMENT_COUNTS=Object.freeze({desktop:18,mobile:12,vr:14});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function cellsFor(study,quality){
  const rand=makeRandom(seedFromString('PP-SOLID-CELLS-2:'+study.seed+':'+study.engine));
  const count=FRAGMENT_COUNTS[quality]||FRAGMENT_COUNTS.desktop;
  const cells=[{x:-SCULPTURE_WIDTH*.5,y:-SCULPTURE_HEIGHT*.5,w:SCULPTURE_WIDTH,h:SCULPTURE_HEIGHT,depth:0}];
  let turn=0;
  while(cells.length<count){
    let best=-1,score=-Infinity;
    for(let i=0;i<cells.length;i++){
      const c=cells[i];
      if(c.w<.16||c.h<.16)continue;
      const s=c.w*c.h*(.82+rand()*.35);
      if(s>score){score=s;best=i;}
    }
    if(best<0)break;
    const c=cells.splice(best,1)[0];
    const ratio=(turn++%2) ? 1-INV_PHI : INV_PHI;
    if(c.w>=c.h*.92){
      const w=c.w*ratio;
      cells.push({...c,w,depth:c.depth+1},{...c,x:c.x+w,w:c.w-w,depth:c.depth+1});
    }else{
      const h=c.h*ratio;
      cells.push({...c,h,depth:c.depth+1},{...c,y:c.y+h,h:c.h-h,depth:c.depth+1});
    }
  }
  // Geometry selection order is independent of any rendering or network load.
  return cells.sort((a,b)=>a.y-b.y||a.x-b.x);
}

function polygon(cell,form,rand,index){
  const cx=cell.x+cell.w/2,cy=cell.y+cell.h/2;
  const w=cell.w*.93,h=cell.h*.92;
  let points;
  if(form==='orbital'){
    points=Array.from({length:14},(_,i)=> {
      const a=i/14*Math.PI*2;
      return [Math.cos(a)*w*.5,Math.sin(a)*h*.5];
    });
  }else if(form==='ribbon'){
    // A curved lens tapering at its ends, rotated according to golden angle.
    points=[];
    for(let i=0;i<=6;i++){
      const t=i/6;points.push([(t-.5)*w, h*(.14+Math.sin(t*Math.PI)*.32)]);
    }
    for(let i=6;i>=0;i--){
      const t=i/6;points.push([(t-.5)*w,-h*(.14+Math.sin(t*Math.PI)*.32)]);
    }
  }else if(form==='strata'){
    points=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
  }else if(form==='radiant'){
    points=[[-w/2,-h*.12],[-w*.13,-h/2],[w*.38,-h*.42],
      [w/2,h*.20],[w*.04,h/2],[-w*.34,h*.36]];
  }else if(form==='lattice'){
    points=[[-w*.48,-h*.36],[w*.22,-h*.50],[w*.49,h*.29],[-w*.13,h*.50],[-w*.49,h*.13]];
  }else if(form==='growth'){
    points=[];
    for(let i=0;i<6;i++){
      const t=i/5;points.push([(t-.5)*w,h*(.12+.34*Math.sin(t*Math.PI))]);
    }
    for(let i=5;i>=0;i--){
      const t=i/5;points.push([(t-.5)*w,-h*(.12+.26*Math.sin(t*Math.PI))]);
    }
  }else if(form==='blocks'){
    points=[[-w/2,-h/2],[w*.38,-h/2],[w/2,-h*.20],[w/2,h*.43],[w*.22,h/2],[-w/2,h*.42]];
  }else{
    points=[[-w*.48,-h*.29],[-w*.22,-h*.50],[w*.12,-h*.27],[w*.40,-h*.49],
      [w/2,h*.08],[w*.18,h*.50],[-w*.08,h*.24],[-w*.49,h*.46]];
  }
  // These polygons are honest solid silhouette sections. Rotations and depth
  // create genuine parallax while keeping the frontal colour relationships.
  const irregularity=(rand()-.5)*.075;
  const angle=form==='ribbon' ? Math.sin(index*GOLDEN_ANGLE)*.10 :
    form==='gestural' ? (rand()-.5)*.22 : irregularity;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  return points.map(([x,y])=>({
    x:clamp(cx+x*ca-y*sa,-SCULPTURE_WIDTH*.53,SCULPTURE_WIDTH*.53),
    y:clamp(cy+x*sa+y*ca,-SCULPTURE_HEIGHT*.53,SCULPTURE_HEIGHT*.53)
  }));
}
export function sculptureFragments(study,quality='desktop'){
  const rand=makeRandom(seedFromString('PP-SOLID-FRAGMENTS-2:'+study.seed+':'+study.engine));
  const form=ENGINE_FORMS[study.engine]||'orbital';
  return cellsFor(study,quality).map((cell,index)=>{
    const centre={x:cell.x+cell.w/2,y:cell.y+cell.h/2};
    const depth=.20+rand()*.52; // Real extruded solid depth, not plane spacing.
    let tiltY=(rand()-.5)*.36,tiltX=(rand()-.5)*.26;
    const t=index/Math.max(1,(FRAGMENT_COUNTS[quality]||18)-1);
    if(form==='ribbon')tiltY+=Math.sin(t*GOLDEN_ANGLE*6)*.28;
    if(form==='growth')tiltX+=(t-.5)*.34;
    if(form==='blocks'||form==='strata'){tiltY*=.27;tiltX*=.27;}
    if(form==='gestural'){tiltY*=1.9;tiltX*=1.6;}
    return {
      index,form,vertices:polygon(cell,form,rand,index),
      x:centre.x,y:centre.y,
      // Shifted extrusions turn a source composition into an irregular object.
      z:(rand()-.5)*.32,
      depth,tiltX,tiltY,
      roll:form==='ribbon'?Math.sin(index*GOLDEN_ANGLE)*.13:(rand()-.5)*.065,
      cell:{...cell},
      sample:{u:clamp(centre.x/SCULPTURE_WIDTH+.5,0,1),
        v:clamp(.5-centre.y/SCULPTURE_HEIGHT,0,1)}
    };
  });
}
