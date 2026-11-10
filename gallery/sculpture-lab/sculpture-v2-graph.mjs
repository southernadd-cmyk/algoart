// PROPORTION PIECE — 3D composition graph. The golden angle determines
// placement, overlap and depth: it is NOT a deformation of a flat mesh.
import {PHI,GOLDEN_ANGLE,clamp} from './sculpture-v2-features.mjs';
export const DEFAULT_SPATIAL_OPTIONS=Object.freeze({
  phiPull:.8,abstraction:.72,depth:.85,connection:.65
});
const round=v=>Math.round(v*100000)/100000;
const hash=s=>{let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
function point3(x,y,z){return {x:round(x),y:round(y),z:round(z)};}
export function buildSpatialGraph(features,options={}){
  const opt={...DEFAULT_SPATIAL_OPTIONS,...options};
  const phi=clamp(opt.phiPull,0,1),abstraction=clamp(opt.abstraction,0,1);
  const spread=clamp(opt.depth,.4,1.3),connection=clamp(opt.connection,0,1);
  const c=features.centre||{x:0,y:0};
  const regions=features.regions.slice(0,18);
  const nodes=regions.map((r,i)=>{
    const angle=i*GOLDEN_ANGLE*phi+(r.orientation||0)*.3;
    const tier=i<5?1:i<11?1/PHI:1/(PHI*PHI);
    const depth=(.20+.46*spread)*Math.cos(angle*PHI)+(i%3-1)*.19*spread;
    const dist=Math.hypot(r.x-c.x,r.y-c.y);
    const helix=abstraction*.22*dist;
    return {
      id:r.id,sourceId:r.id,kind:'mass',
      source:{x:r.x,y:r.y},weight:r.weight,colour:r.color,
      radius:clamp(.11+r.span*.46*tier,.10,.35),
      breadth:clamp(.075+r.breadth*.7,.07,.32),
      position:point3(
        r.x+Math.cos(angle)*helix,
        r.y+Math.sin(angle)*helix*.5,
        depth*spread
      ),
      rotation:round(angle),role:r.role
    };
  });
  const sorted=[...nodes].sort((a,b)=>b.weight-a.weight);
  const links=[];
  for(let i=1;i<sorted.length;i++){
    const node=sorted[i],earlier=sorted.slice(0,i);
    const near=earlier.reduce((best,candidate)=>{
      const d=Math.hypot(candidate.position.x-node.position.x,
        candidate.position.y-node.position.y,candidate.position.z-node.position.z);
      return d<best.d?{d,node:candidate}:best;
    },{d:Infinity,node:earlier[0]});
    links.push({from:node.id,to:near.node.id,relationship:'load-bearing',
      strength:round(.45+connection*.55)});
  }
  const gestures=features.gestures.slice(0,24).map((g,i)=>{
    const src=g.points;
    const angle=i*GOLDEN_ANGLE*phi+((hash(g.id)%100)/100)*.16;
    const phase=angle+Math.PI*(i%3)/PHI;
    const mid=src[Math.floor(src.length/2)];
    const radial=.26+.21*abstraction;
    const turns=.62+1.7*abstraction*phi;
    const points=src.map((p,j)=>{
      const t=j/Math.max(1,src.length-1);
      const sweep=turns*(t-.5);
      const x0=p.x-c.x,y0=p.y-c.y;
      // The gesture itself occupies three-dimensional space: its projection
      // may change dramatically as it goes behind, over and around the core.
      const x=p.x+abstraction*.13*Math.sin(phase+sweep)*Math.sin(Math.PI*t);
      const z=(.16*Math.sin(phase)+radial*Math.sin(phase+sweep*2.2))*
        spread+(.36+.15*phi)*spread*Math.sin(Math.PI*t+phase);
      const y=p.y+.065*abstraction*Math.cos(sweep+phase)+
        .08*abstraction*Math.sin(Math.PI*t*2+angle);
      return point3(x,y,z+.18*Math.sin(x0*3+y0*PHI+angle)*spread);
    });
    // Rearward continuation is real geometry and shares the gesture endpoint.
    const tail=points[points.length-1];
    const rear=point3(
      c.x+(tail.x-c.x)/PHI+Math.cos(phase+GOLDEN_ANGLE)*.24*abstraction,
      c.y+(tail.y-c.y)/PHI,
      -.55*spread-.11*Math.sin(phase)
    );
    const head=points[0];
    const returnPoint=point3(
      c.x+(head.x-c.x)/PHI+Math.cos(phase)*.18*abstraction,
      c.y+(head.y-c.y)/PHI,
      -.40*spread
    );
    return {
      id:g.id,sourceId:g.id,source:g.source,colour:g.color,
      radius:clamp(.024+(g.width||.015)*1.4,.022,.10),
      weight:g.weight,role:g.role,paths:points,
      returnPath:[tail,point3((tail.x+rear.x)/2,tail.y*.68+rear.y*.32,
        -.15*spread),rear,returnPoint,head],
      phase:round(phase)
    };
  });
  const graph={
    version:2,kind:'three-dimensional-composition',
    options:{phiPull:phi,abstraction,depth:spread,connection},
    nodes,links,gestures,
    centre:point3(c.x,c.y,0),
    sourceKind:features.sourceKind
  };
  if(nodes.length<1||gestures.length<1)throw Error('Insufficient painting features for sculpture');
  return graph;
}
