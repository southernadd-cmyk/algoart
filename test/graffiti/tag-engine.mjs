// Procedural writing for PROPORTION PIECE. The letter centre-lines are original
// geometry, developed from fonts/source/draw-glyphs.cjs. Ink uses the existing
// A.stroke marker renderer plus a pressure/speed-sensitive continuous ribbon.
export const VERSION = 1;
export const HANDS = Object.freeze({
  loop: Object.freeze({ name:'Loop', description:'Open loops, round ink and a returning underline.', lean:.20, width:1.02, spacing:-7, weight:6.2, angle:.4, flourish:1 }),
  cut: Object.freeze({ name:'Cut', description:'Compressed, angular letters written with a broad nib.', lean:.31, width:.78, spacing:-3, weight:9.4, angle:-.68, flourish:.65 }),
  rush: Object.freeze({ name:'Rush', description:'Tall, fast strokes with a steep lean and long exits.', lean:.43, width:.68, spacing:-8, weight:4.7, angle:.15, flourish:1.3 })
});
const L=(...pairs)=>pairs.map(([x,y])=>({x,y}));
const arc=(cx,cy,rx,ry,a,b,n=20)=>Array.from({length:n+1},(_,i)=>{const t=(a+(b-a)*i/n)*Math.PI/180;return {x:cx+Math.cos(t)*rx,y:cy+Math.sin(t)*ry};});
const p=(points,smooth=true)=>({points,smooth});
// These are pen movements, not font outlines. Alternate movements can enter
// and leave a letter at different points; neighbouring letters share a rhythm.
const G={
 A:[p(L([0,105],[27,-6],[57,96]),false),p(L([5,65],[55,52]),false)],
 B:[p(L([4,99],[4,-7]),false),p(L([2,3],[39,-1],[53,15],[43,37],[4,48],[44,47],[58,64],[49,90],[3,100]))],
 C:[p(arc(32,49,31,48,315,60))],
 D:[p(L([3,101],[3,-3]),false),p(L([1,2],[40,-1],[61,23],[61,61],[42,92],[1,101]))],
 E:[p(L([58,0],[4,8],[1,97],[58,88]),false),p(L([3,52],[46,43]),false)],
 F:[p(L([2,104],[5,5],[64,-4]),false),p(L([4,51],[46,40]),false)],
 G:[p([...arc(32,49,31,47,310,65),...L([62,90],[61,52],[36,55])])],
 H:[p(L([1,0],[1,101]),false),p(L([56,-4],[56,99]),false),p(L([-3,57],[59,42]),false)],
 I:[p(L([2,4],[33,-2]),false),p(L([18,0],[13,102]),false),p(L([-2,104],[35,95]),false)],
 J:[p(L([51,-2],[51,73],[42,95],[20,100],[2,83],[0,66])),p(L([28,3],[68,-4]),false)],
 K:[p(L([4,-3],[2,104]),false),p(L([60,-4],[4,53],[65,96]),false)],
 L:[p(L([5,-4],[1,99],[59,88]),false)],
 M:[p(L([0,101],[4,-2],[32,64],[64,-6],[66,96]),false)],
 N:[p(L([0,102],[3,-2],[55,96],[57,-6]),false)],
 O:[p(arc(31,49,30,49,-72,288,34))],
 P:[p(L([2,104],[5,-3]),false),p(L([3,4],[40,-3],[57,14],[49,40],[6,50]))],
 Q:[p(arc(31,49,30,49,-72,288,34)),p(L([32,71],[64,111]),false)],
 R:[p(L([2,103],[5,-3]),false),p(L([3,4],[40,-3],[56,14],[48,39],[6,50])),p(L([21,48],[66,101]),false)],
 S:[p(L([59,7],[37,-1],[10,8],[2,28],[24,47],[51,60],[57,77],[39,98],[11,99],[-1,88]))],
 T:[p(L([-6,8],[65,-4]),false),p(L([30,2],[24,105]),false)],
 U:[p(L([2,-3],[0,68],[10,95],[32,101],[56,81],[60,-6]))],
 V:[p(L([-2,-1],[26,103],[62,-6]),false)],
 W:[p(L([-3,-1],[12,99],[36,35],[57,97],[81,-7]),false)],
 X:[p(L([1,-2],[59,101]),false),p(L([57,-5],[-3,103]),false)],
 Y:[p(L([-1,-2],[28,49],[61,-7]),false),p(L([28,49],[19,107]),false)],
 Z:[p(L([0,8],[61,-3],[-3,103],[64,91]),false)],
 '0':[p(arc(30,49,28,48,-72,288,34)),p(L([6,89],[53,8]),false)],
 '1':[p(L([1,25],[25,-2],[20,101]),false),p(L([0,103],[42,94]),false)],
 '2':[p(L([0,20],[18,0],[45,0],[56,21],[43,47],[-2,101],[59,92]))],
 '3':[p(L([0,9],[38,-2],[54,15],[35,43],[6,49],[39,48],[56,67],[42,93],[-1,103]))],
 '4':[p(L([45,104],[49,-5],[0,65],[61,54]),false)],
 '5':[p(L([57,-3],[6,5],[1,49],[36,42],[55,59],[51,81],[29,101],[-2,95]))],
 '6':[p(L([51,0],[25,3],[5,30],[0,67],[10,96],[35,100],[55,79],[50,54],[25,48],[1,69]))],
 '7':[p(L([-3,7],[60,-3],[14,106]),false)],
 '8':[p(L([26,49],[3,24],[12,1],[39,-1],[52,17],[26,49],[0,76],[10,100],[38,98],[56,76],[26,49]))],
 '9':[p(L([54,43],[29,52],[5,39],[2,15],[22,-1],[47,2],[57,25],[52,68],[32,98],[9,103]))],
 '-':[p(L([0,55],[39,47]),false)],
 '.':[p(L([4,98],[5,99]),false)],
 '!':[p(L([12,-4],[4,74]),false),p(L([2,99],[3,100]),false)],
 '?':[p(L([0,16],[20,-1],[44,5],[48,23],[25,51],[20,74])),p(L([18,99],[19,100]),false)],
 'φ':[p([...arc(31,63,27,27,238,-90,28),...L([29,40],[25,80],[20,125])])]
};

export function makeRandom(seed){
 let a=2166136261;
 for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}
 const n=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 return {n,range:(x,y)=>x+(y-x)*n(),int:(x,y)=>Math.floor(x+(y-x+1)*n()),chance:q=>n()<q,pick:xs=>xs[Math.floor(n()*xs.length)]};
}
export function normaliseText(value){
 return String(value??'').normalize('NFKC').replace(/ϕ/g,'φ').toUpperCase().replace(/Φ/g,'φ').replace(/[^A-Z0-9φ .!?-]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
}
function sample(points,smooth){
 const out=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
  const steps=Math.max(3,Math.ceil(Math.hypot(c.x-b.x,c.y-b.y)/3));
  for(let j=0;j<steps;j++){
   const t=j/steps,t2=t*t,t3=t2*t;
   const coord=k=>smooth?.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3):b[k]+(c[k]-b[k])*t;
   out.push({x:coord('x'),y:coord('y')});
  }
 }
 out.push({...points.at(-1)});return out;
}
function boundsOf(strokes,padding){
 const points=strokes.flatMap(s=>s.points),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const x=Math.min(...xs)-padding,y=Math.min(...ys)-padding;
 return {x,y,width:Math.max(...xs)-x+padding,height:Math.max(...ys)-y+padding};
}
export function createTag(text,{seed='PP-GRAFFITI-01',hand='loop',ink='#232624'}={}){
 if(!HANDS[hand])throw new RangeError('Unknown handwriting style: '+hand);
 const word=normaliseText(text)||'PHI',h=HANDS[hand],r=makeRandom(seed+'|'+hand+'|'+word);
 const strokes=[],lean=h.lean+r.range(-.035,.035),lift=r.range(-.07,.055),phase=r.range(0,Math.PI*2);
 let cursor=0;
 const add=(points,kind='letter',weight=1,smooth=true)=>strokes.push({points:sample(points,smooth),kind,weight,phase:r.range(0,6.28),pressure:r.range(.86,1.12),nib:h.angle+r.range(-.12,.12)});
 for(let index=0;index<word.length;index++){
  const ch=word[index];if(ch===' '){cursor+=30;continue;}
  let glyph=G[ch];
  // Real alternative constructions, beyond perturbing the same letter.
  if(ch==='A'&&hand==='loop'&&r.chance(.7))glyph=[p(L([55,99],[38,1],[14,16],[-1,65],[7,94],[32,85],[51,58],[61,103])),p(L([6,63],[50,52]))];
  if(ch==='E'&&hand==='loop')glyph=[p(L([53,11],[29,-1],[5,17],[3,38],[36,43],[6,52],[-1,76],[14,100],[54,87]))];
  if(ch==='S'&&hand==='cut')glyph=[p(L([61,0],[3,12],[3,43],[55,54],[55,88],[0,104]),false)];
  if(ch==='I'&&hand==='rush')glyph=[p(L([13,-7],[7,104]),false)];
  if(ch==='R'&&hand==='rush')glyph=[p(L([0,105],[5,-4],[43,2],[51,24],[7,53],[65,102]),false)];
  const stretch=r.range(.93,1.08),wide=h.width*r.range(.91,1.06),bounce=r.range(-5,5)+Math.sin(index*1.7+phase)*3;
  const localMax=Math.max(...glyph.flatMap(s=>s.points.map(p=>p.x)));
  const transform=q=>{
   const y=q.y*stretch+bounce;
   return {x:cursor+q.x*wide+(100-y)*lean+Math.sin(q.y*.037+phase+index)*1.3,y:y+cursor*lift};
  };
  for(const s of glyph)add(s.points.map(transform),'letter',1,s.smooth&&hand!=='cut');
  const advance=Math.max(19,localMax*wide+h.spacing+r.range(-3,4));
  // A low connector belongs to this word's writing rhythm, not to a font glyph.
  if(hand==='loop'&&index<word.length-1&&word[index+1]!==' '&&r.chance(.56)){
   add(L([cursor+advance-7,93+cursor*lift],[cursor+advance+3,103+cursor*lift],[cursor+advance+14,83+cursor*lift]),'join',.58,true);
  }
  cursor+=advance;
 }
 const endY=cursor*lift,under=116+endY*.5;
 if(hand==='loop'){
  add(L([-15,under+10],[cursor*.28,under-3],[cursor*.78,under-13],[cursor+37,under-23],[cursor+19,under-5],[cursor*.55,under+8],[cursor*.14,under+16]),'flourish',.75,true);
 }else if(hand==='cut'){
  add(L([-9,124],[cursor+24,102+endY]),'flourish',.76,false);
  if(r.chance(.65))add(L([cursor*.37,136],[cursor*.88,123+endY]),'flourish',.5,false);
 }else{
  add(L([-24,127],[cursor*.34,111],[cursor+57,91+endY]),'flourish',.68,true);
  add(L([cursor-10,79+endY],[cursor+28,58+endY],[cursor+9,122+endY]),'flourish',.6,true);
 }
 const inkR=makeRandom(seed+'|ink'),opacity=inkR.range(.83,.94);
 return {version:VERSION,text:word,seed:String(seed),hand,ink,weight:h.weight,opacity,strokes,bounds:boundsOf(strokes,h.weight*1.6)};
}

function drawRibbon(ctx,stroke,tag,progress){
 const n=Math.min(stroke.points.length,Math.max(2,Math.ceil(stroke.points.length*progress)));
 const points=stroke.points.slice(0,n),left=[],right=[];
 for(let i=0;i<points.length;i++){
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;
  const t=i/(stroke.points.length-1),speed=Math.min(1,len/6),pressure=.81+.16*Math.sin(t*5.1+stroke.phase)+.1*Math.sin(t*11+stroke.phase*.5);
  const taper=.4+.6*Math.min(1,t*13,(1-t)*10);
  const chisel=tag.hand==='cut'?.40+.72*Math.abs(Math.sin(Math.atan2(dy,dx)-stroke.nib)):1;
  const width=tag.weight*stroke.weight*stroke.pressure*pressure*(1-.18*speed)*taper*chisel;
  left.push({x:points[i].x-dy/len*width*.5,y:points[i].y+dx/len*width*.5});
  right.push({x:points[i].x+dy/len*width*.5,y:points[i].y-dx/len*width*.5});
 }
 ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(const q of left.slice(1))ctx.lineTo(q.x,q.y);for(const q of right.reverse())ctx.lineTo(q.x,q.y);ctx.closePath();ctx.fill();
 return points;
}
// Draw in tag coordinates. Callers choose resolution/placement with ctx.transform.
// A separate RNG per pen movement keeps replay independent of frame rate.
export function drawTag(ctx,tag,{progress=1,marker=globalThis.AlgoArt}={}){
 if(!marker?.stroke)throw new Error('Load the PROPORTION PIECE marker renderer first.');
 const total=tag.strokes.reduce((n,s)=>n+s.points.length,0),budget=total*Math.max(0,Math.min(1,progress));let used=0;
 ctx.save();ctx.fillStyle=tag.ink;
 for(let k=0;k<tag.strokes.length;k++){
  const s=tag.strokes[k],fraction=Math.min(1,(budget-used)/s.points.length);used+=s.points.length;if(fraction<=0)break;
  ctx.globalAlpha=tag.opacity;
  const points=drawRibbon(ctx,s,tag,fraction);
  // The familiar softly irregular marker pass sits inside the changing-width
  // ribbon. Low wobble is deliberate: a confident hand has coherent motion.
  marker.stroke(ctx,points,tag.ink,{pen:tag.hand==='cut'?'broad':'felt',overdraw:1,wobble:1.8,thickness:tag.weight*s.weight*.28,pressure:46,opacity:42,dryness:18},marker.makeR(tag.seed+'|pass|'+k),false);
  // Sparse dry-nib tracks follow the movement, using destination-out only on
  // the transparent ink layer, never on the wall underneath it.
  if(points.length>10){
   const r=makeRandom(tag.seed+'|dry|'+k),offset=r.range(-1,1)*tag.weight*.16;
   ctx.save();ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=.13;ctx.strokeStyle='#000';ctx.lineWidth=.35;
   ctx.beginPath();ctx.moveTo(points[0].x+offset,points[0].y);
   for(const q of points.slice(1))ctx.lineTo(q.x+offset,q.y);ctx.stroke();ctx.restore();
  }
 }
 ctx.restore();return total;
}

const WORDS=Object.freeze(['PHI','ECHO','LOOP','DRIFT','FORM','MARK','GOLD','GHOST','VOID','INK','STILL','TRACE']);
const INKS=Object.freeze(['#242a28','#4c2630','#293849','#e4ddd0','#3e4938']);
// A floor ID is a stable exhibition identity (normally its date), never a
// ground-floor test or the total tower height. Adding floors cannot reshuffle it.
export function planFloorTags({floorId,seed='PP-GRAFFITI-01',text='',hand='mixed',ink='mixed',count='auto'}={}){
 if(floorId===undefined||floorId===null||String(floorId)==='')throw new TypeError('A stable floorId is required.');
 if(hand!=='mixed'&&!HANDS[hand])throw new RangeError('Unknown handwriting style.');
 if(!['auto',1,2,'1','2'].includes(count))throw new RangeError('Each floor must have one or two tags.');
 const key=String(seed)+'|floor|'+String(floorId),r=makeRandom(key+'|count'),n=count==='auto'?(r.chance(.55)?2:1):Number(count);
 return Array.from({length:n},(_,slot)=>{
  const q=makeRandom(key+'|slot|'+slot),writer=hand==='mixed'?q.pick(Object.keys(HANDS)):hand;
  return {id:key+'|'+slot,floorId:String(floorId),slot,hand:writer,text:normaliseText(text)||q.pick(WORDS),ink:ink==='mixed'?q.pick(INKS):ink,seed:key+'|tag|'+slot,
   // Normalised prototype positions; real tower integration will select solid
   // wall segments from each exhibition's room plan before placing these tags.
   x:n===1?.5:slot===0?.28:.73,y:slot===0?.58:.51,scale:q.range(.87,1.06),rotation:q.range(-.07,.055)};
 });
}
