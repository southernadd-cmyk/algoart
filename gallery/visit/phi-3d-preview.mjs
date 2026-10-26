// Lightweight 3D architectural preview of the phi floor. No external dependencies.
// Camera orbit and perspective are implemented here so this remains independent of the live tower.
export function mountPhi3D(canvas){
 const ctx=canvas.getContext('2d');let model=null,yaw=-.72,elevation=.85,zoom=1,drag=null;
 function setModel(next){model=next;draw();}
 function resize(){const d=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(canvas.clientWidth*d);canvas.height=Math.round(canvas.clientHeight*d);draw();}
 function draw(){
  if(!model)return;const {floor,circulation,physical,voids}=model;
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#f5f2e9';ctx.fillRect(0,0,W,H);
  const cx=floor.root.x+floor.root.w/2,cz=floor.root.z+floor.root.h/2;
  const scale=Math.min(W/110,H/80)*zoom;
  const project=(x,y,z)=>{let X=x-cx,Z=z-cz;let a=X*Math.cos(yaw)-Z*Math.sin(yaw),b=X*Math.sin(yaw)+Z*Math.cos(yaw);
   return {x:W/2+a*scale,y:H*.66+(b*Math.sin(elevation)-y*Math.cos(elevation))*scale,depth:b*Math.cos(elevation)+y*Math.sin(elevation)};};
  const polygons=[];const add=(corners,fill,stroke='#64726f',width=.8)=>{const pts=corners.map(p=>project(...p));polygons.push({pts,fill,stroke,width,depth:pts.reduce((s,p)=>s+p.depth,0)/pts.length});};
  // Floors: removed golden cells are really open holes, not painted-over floor slabs.
  for(const c of floor.rooms)add([[c.x,0,c.z],[c.x+c.w,0,c.z],[c.x+c.w,0,c.z+c.h],[c.x,0,c.z+c.h]],'#d9d4c9','#b5aa96');
  for(const w of physical.walls){
   const h=3.25, a=w.axis==='x'?[w.at,w.lo]:[w.lo,w.at],b=w.axis==='x'?[w.at,w.hi]:[w.hi,w.at];
   add([[a[0],0,a[1]],[b[0],0,b[1]],[b[0],h,b[1]],[a[0],h,a[1]]],'rgba(209,205,193,.64)','rgba(94,100,92,.6)');
  }
  for(const b of circulation.bridges||[]){
   const x0=b.axis==='x'?b.from:b.centre-b.width/2,x1=b.axis==='x'?b.to:b.centre+b.width/2;
   const z0=b.axis==='z'?b.from:b.centre-b.width/2,z1=b.axis==='z'?b.to:b.centre+b.width/2;
   add([[x0,.08,z0],[x1,.08,z0],[x1,.08,z1],[x0,.08,z1]],'rgba(116,182,196,.40)','#518b94',1.8);
   for(const side of [-1,1]){
    const rail=side===-1?(b.axis==='x'?z0:x0):(b.axis==='x'?z1:x1);
    const endpoints=b.axis==='x'?[[x0,rail],[x1,rail]]:[[rail,z0],[rail,z1]];
    add([[endpoints[0][0],.15,endpoints[0][1]],[endpoints[1][0],.15,endpoints[1][1]],[endpoints[1][0],1.45,endpoints[1][1]],[endpoints[0][0],1.45,endpoints[0][1]]],'rgba(144,203,210,.22)','#668f94',1);
   }
  }
  for(const s of physical.sculptures){const x=s.x,z=s.z,d=.45;add([[x-d,0,z-d],[x+d,0,z-d],[x+d,.85,z-d],[x-d,.85,z-d]],'#b58a6e');add([[x-d,.85,z-d],[x+d,.85,z-d],[x+d,.85,z+d],[x-d,.85,z+d]],'#c9a48e');}
  polygons.sort((a,b)=>b.depth-a.depth);
  for(const p of polygons){ctx.beginPath();p.pts.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fillStyle=p.fill;ctx.fill();ctx.strokeStyle=p.stroke;ctx.lineWidth=p.width*(canvas.width/canvas.clientWidth);ctx.stroke();}
  ctx.fillStyle='#3c514c';ctx.font=(12*canvas.width/canvas.clientWidth)+'px Georgia';ctx.fillText('Drag to orbit · scroll to zoom',18,24);
 }
 canvas.style.touchAction='none';
 let activePointer=null,touchGesture=null;
 const rotate=(dx,dy)=>{yaw+=dx*.009;elevation=Math.max(.24,Math.min(1.40,elevation+dy*.006));draw();};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')return;
  if(e.cancelable)e.preventDefault();
  activePointer=e.pointerId;drag={x:e.clientX,y:e.clientY};
  canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||!drag||activePointer!==e.pointerId)return;
  rotate(e.clientX-drag.x,e.clientY-drag.y);
  drag={x:e.clientX,y:e.clientY};
 });
 const endPointer=e=>{if(activePointer===e.pointerId){drag=null;activePointer=null;}};
 canvas.addEventListener('pointerup',endPointer);
 canvas.addEventListener('pointercancel',endPointer);
 // Explicit touch handling also covers mobile WebViews that cancel pointer drags.
 canvas.addEventListener('touchstart',e=>{
  if(e.cancelable)e.preventDefault();
  const touches=[...e.touches];
  if(touches.length===1)touchGesture={x:touches[0].clientX,y:touches[0].clientY,pinch:null};
  else if(touches.length>=2)touchGesture={x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2,
    pinch:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY)};
 },{passive:false});
 canvas.addEventListener('touchmove',e=>{
  if(e.cancelable)e.preventDefault();if(!touchGesture)return;
  const touches=[...e.touches];if(!touches.length)return;
  const x=touches.length===1?touches[0].clientX:(touches[0].clientX+touches[1].clientX)/2;
  const y=touches.length===1?touches[0].clientY:(touches[0].clientY+touches[1].clientY)/2;
  if(touches.length===1&&touchGesture.pinch===null)rotate(x-touchGesture.x,y-touchGesture.y);
  if(touches.length>=2){
   const pinch=Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
   if(touchGesture.pinch){zoom=Math.max(.55,Math.min(2.8,zoom*pinch/touchGesture.pinch));draw();}
   touchGesture.pinch=pinch;
  }
  touchGesture.x=x;touchGesture.y=y;
 },{passive:false});
 canvas.addEventListener('touchend',e=>{touchGesture=null;});
 canvas.addEventListener('touchcancel',()=>{touchGesture=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.55,Math.min(2.8,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
 window.addEventListener('resize',resize);resize();
 return {setModel,draw};
}
