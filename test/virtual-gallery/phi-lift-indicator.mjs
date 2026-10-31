// The car display follows physical height, independently of which exhibition
// remains loaded during the ride. All floor numbers retain their archive date.
const dateFormat=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const labels=new Map();
function dateLabel(date){
 if(!date||date==='__phi_reception__')return 'Reception';
 if(!labels.has(date))labels.set(date,dateFormat.format(new Date(date+'T12:00:00Z')));
 return labels.get(date);
}
export function phiLiftIndicatorState({height,spacing=6.2,dates,currentFloor=0,targetFloor=null,phase='idle'}){
 const floor=phase==='moving'?Math.max(0,Math.min(dates.length-1,Math.round(height/spacing))):currentFloor;
 const date=dates[floor];
 const primary=floor===0?'G · Reception':floor+' · '+dateLabel(date);
 let secondary='Archive lift';
 if(phase!=='idle'&&targetFloor!==null){
  const target=targetFloor===0?'Reception':dateLabel(dates[targetFloor])+' · Floor '+targetFloor;
  secondary=phase==='preparing'?'Preparing '+target:(targetFloor>currentFloor?'Ascending to ':'Descending to ')+target;
 }
 return {floor,date,primary,secondary,phase,font:'AlgoArt Marker'};
}
export function paintPhiLiftIndicator(display,state){
 if(display.last?.primary===state.primary&&display.last?.secondary===state.secondary)return false;
 const g=display.context,w=display.canvas.width,h=display.canvas.height;
 g.clearRect(0,0,w,h);g.fillStyle='#202d2a';g.fillRect(0,0,w,h);
 g.fillStyle='#f0e8c9';g.textAlign='center';g.font='76px "AlgoArt Marker", Georgia';g.fillText(state.primary,w/2,94,w-46);
 g.fillStyle='#b9c5af';g.font='35px "AlgoArt Marker", Georgia';g.fillText(state.secondary,w/2,158,w-46);
 display.last=state;display.texture.needsUpdate=true;return true;
}
