// The geometric alphabet is built here, before any handwriting deformation.
// Phi is a construction rule for this project, not a historical claim about
// the reference artists. Small fractions below are curve/control-point choices.
export const PHI=(1+Math.sqrt(5))/2;
export function goldenMetrics(height=100,ratio=PHI){
 if(!Number.isFinite(height)||height<=0||!Number.isFinite(ratio)||ratio<=1)throw new RangeError('Positive height and a ratio above one are required.');
 return Object.freeze({ratio,height,width:height/ratio,short:height/(ratio*ratio),long:height/ratio,unit:height/ratio**6,inner:height/ratio**3,outer:height/ratio**2});
}
const L=(...ps)=>ps.map(([x,y])=>({x,y}));
const path=(points,smooth=false)=>({points,smooth});
const arc=(cx,cy,rx,ry,a,b,angular=false)=>{
 const n=angular?Math.max(3,Math.ceil(Math.abs(b-a)/45)):Math.max(12,Math.ceil(Math.abs(b-a)/10));
 return Array.from({length:n+1},(_,i)=>{const t=(a+(b-a)*i/n)*Math.PI/180;return{x:cx+Math.cos(t)*rx,y:cy+Math.sin(t)*ry};});
};
export function letterSkeleton(character,{hand='loop',variant=0,metrics=goldenMetrics()}={}){
 const {height:H,width:W,short:a,long:b,unit:u,ratio}=metrics;
 const v=W/ratio,k=W/(ratio*ratio),angular=hand==='cut';
 const A=(cx,cy,rx,ry,start,end)=>arc(cx,cy,rx,ry,start,end,angular);
 const P=(points,smooth=!angular)=>path(points,smooth);
 const bowl=(top,height,width)=>P(A(0,top+height/2,width,height/2,-90,90));
 const oval=()=>P(A(W/2,H/2,W/2,H/2,-90,270));
 const barX=W*(1-b/H)/2;
 const letters={
  A:[path(L([0,H],[W/2,0],[W,H])),path(L([barX,b],[W-barX,b]))],
  B:[path(L([0,H],[0,0])),bowl(0,a,v),bowl(a,b,W)],
  C:[P(A(W/2,H/2,W/2,H/2,-45,-315))],
  D:[path(L([0,H],[0,0])),bowl(0,H,W)],
  E:[path(L([W,0],[0,0],[0,H],[W,H])),path(L([0,b],[v,b]))],
  F:[path(L([0,H],[0,0],[W,0])),path(L([0,b],[v,b]))],
  G:[P(A(W/2,H/2,W/2,H/2,-45,-315)),path(L([W,H-a/2],[W,b],[v,b]))],
  H:[path(L([0,0],[0,H])),path(L([W,0],[W,H])),path(L([0,b],[W,b]))],
  I:[path(L([0,0],[v,0])),path(L([v/2,0],[v/2,H])),path(L([0,H],[v,H]))],
  J:[P(L([W,0],[W,b],[W-u,H-u],[v,H],[u,H-u],[0,b])),path(L([k,0],[W+u,0]))],
  K:[path(L([0,0],[0,H])),path(L([W,0],[0,b],[W,H]))],
  L:[path(L([0,0],[0,H],[W,H]))],
  M:[path(L([0,H],[0,0],[W/2,b],[W,0],[W,H]))],
  N:[path(L([0,H],[0,0],[W,H],[W,0]))],
  O:[oval()],
  P:[path(L([0,H],[0,0])),bowl(0,a,W)],
  Q:[oval(),path(L([v,b],[W+u,H+u]))],
  R:[path(L([0,H],[0,0])),bowl(0,a,W),path(L([k,a],[W,H]))],
  S:[P([...A(W/2,a/2,W/2,a/2,-40,-270),...A(W/2,a+b/2,W/2,b/2,-90,140)])],
  T:[path(L([-u,0],[W+u,0])),path(L([W/2,0],[W/2,H]))],
  U:[path(L([0,0],[0,b])),P(A(W/2,b,W/2,a,180,0)),path(L([W,b],[W,0]))],
  V:[path(L([0,0],[W/2,H],[W,0]))],
  W:[path(L([0,0],[k,H],[W/2,b],[W-k,H],[W,0]))],
  X:[path(L([0,0],[W,H])),path(L([W,0],[0,H]))],
  Y:[path(L([0,0],[W/2,a],[W,0])),path(L([W/2,a],[W/2,H]))],
  Z:[path(L([0,0],[W,0],[0,H],[W,H]))],
  '0':[oval(),path(L([u,H-u],[W-u,u]))],
  '1':[path(L([0,a],[k,0],[k,H])),path(L([0,H],[v,H]))],
  '2':[P([...A(W/2,a/2,W/2,a/2,180,360),...L([W,a/2],[v,a],[0,H],[W,H])])],
  '3':[bowl(0,a,W),bowl(a,b,W)],
  '4':[path(L([v,H],[v,0],[0,b],[W,b]))],
  '5':[path(L([W,0],[0,0],[0,a])),P([...L([0,a],[W/2,a]),...A(W/2,a+b/2,W/2,b/2,-90,140)])],
  '6':[P([...L([W,0],[k,a],[0,b]),...A(W/2,b,W/2,a,180,540)])],
  '7':[path(L([0,0],[W,0],[k,H]))],
  '8':[P(A(W/2,a/2,v/2,a/2,-90,270)),P(A(W/2,a+b/2,W/2,b/2,-90,270))],
  '9':[P(A(W/2,a/2,W/2,a/2,-90,270)),path(L([W,a/2],[W,b],[k,H]))],
  '-':[path(L([0,b],[v,b]))],'.':[path(L([u,H-u],[u,H]))],
  '!':[path(L([u,0],[u,b])),path(L([u,H-u],[u,H]))],
  '?':[P([...A(W/2,a/2,W/2,a/2,180,360),...L([W,a/2],[W/2,b],[W/2,H-u*2])]),path(L([W/2,H-u],[W/2,H]))],
  'φ':[P([...A(W/2,b,W/2,a,235,-90),...L([W/2,a],[W/2,H+a])])]
 };
 let strokes=letters[character];if(!strokes)throw new RangeError('Unsupported letter: '+character);
 // Hand-specific constructions reflect observed writing habits: open bowls,
 // broken/angular counters, simple single-stroke capitals and broad terminals.
 if(hand==='loop'){
  if(character==='A'&&variant%2)strokes=[P(L([W,H],[v,0],[k,u],[-u,b],[u,H],[v,b],[W,b-u],[W,H+u])),P(L([0,b],[W,b-u]))];
  if(character==='E')strokes=[P(L([W,u],[v,0],[u,u],[0,a-u],[v,a],[0,b],[u,H],[W,H-u]))];
  if(character==='I')strokes=[P(L([-u,u],[v/2,0],[v/2,H],[v+u,H-u]))];
  if(character==='M')strokes=[P(L([0,H],[u,0],[W/2,b],[W-u,0],[W,H]))];
  if(character==='R')strokes=[P(L([0,H],[0,0],[v,0],[W,a/2],[v,a],[0,a],[W+u,H+u]))];
 }
 if(hand==='cut'){
  if(character==='O'||character==='0')strokes=[path(L([k,0],[W-u,u],[W,H-u],[v,H],[u,H-u],[0,u],[k,0]))];
  if(character==='S')strokes=[path(L([W,0],[u,0],[0,u],[0,a],[W,b],[W,H-u],[W-u,H],[0,H]))];
  if(character==='E')strokes=[path(L([W,u],[W-u,0],[0,u],[0,H-u],[u,H],[W,H-u])),path(L([0,b],[v,b-u]))];
  if(character==='I')strokes=[path(L([0,u],[v,0])),path(L([v/2,0],[v/2,H])),path(L([0,H],[v,H-u]))];
 }
 if(hand==='rush'){
  if(character==='I')strokes=[path(L([u,0],[u,H]))];
  if(character==='A'&&variant%2)strokes=[path(L([0,H],[W/2,0],[W,H])),path(L([-u,b],[W+u,b]))];
 }
 return {character,strokes,width:character==='I'?v:character==='.'||character==='!'?u*2:character==='-'?v:W};
}

export function drawConstruction(ctx,tag){
 const {height:H,width:W,short:a,long:b,unit:u}=tag.construction.metrics;
 ctx.save();ctx.strokeStyle='#f3e3a6';
 // Set explicitly rather than using a font: the guide follows the exact
 // letter frames, including each writer's lean, width and baseline motion.
 ctx.lineWidth=.65;ctx.globalAlpha=.87;ctx.setLineDash([u,u]);
 for(const frame of tag.construction.letters){
  const point=(x,y)=>({x:frame.x+x*frame.wide+(H-y*frame.stretch-frame.bounce)*frame.lean,y:y*frame.stretch+frame.bounce+frame.x*tag.construction.lift});
  const draw=ps=>{const q=ps.map(([x,y])=>point(x,y));ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);for(const p of q.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();};
  draw([[0,0],[W,0],[W,H],[0,H],[0,0]]);draw([[0,a],[W,a]]);draw([[0,b],[W,b]]);draw([[W/tag.construction.metrics.ratio,0],[W/tag.construction.metrics.ratio,H]]);
 }
 ctx.restore();
}
