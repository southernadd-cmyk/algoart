// Optical spacing from the actual neighbouring pen paths. It is planned at
// the design weight, independently of the user's paint-width control.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function envelope(group,top,step,count){
 const bands=Array.from({length:count},()=>({left:Infinity,right:-Infinity}));
 for(const stroke of group.movements)for(const point of stroke.points){
  const band=clamp(Math.floor((point.y-top)/step),0,count-1);
  bands[band].left=Math.min(bands[band].left,point.x);bands[band].right=Math.max(bands[band].right,point.x);
 }
 return bands;
}
export function opticalGap(left,right){
 const a=left.movements.flatMap(s=>s.points),b=right.movements.flatMap(s=>s.points);
 const top=Math.max(Math.min(...a.map(p=>p.y)),Math.min(...b.map(p=>p.y))),bottom=Math.min(Math.max(...a.map(p=>p.y)),Math.max(...b.map(p=>p.y)));
 if(bottom<=top)return null;
 const count=24,step=(bottom-top)/count;
 const bandsA=envelope(left,top,step,count),bandsB=envelope(right,top,step,count),gaps=[];
 for(let i=1;i<count-1;i++)if(Number.isFinite(bandsA[i].right)&&Number.isFinite(bandsB[i].left))gaps.push(bandsB[i].left-bandsA[i].right);
 if(!gaps.length)return null;gaps.sort((x,y)=>x-y);
 // Ignore a solitary endpoint/overhang when judging the visual space.
 return gaps[Math.floor(gaps.length*.15)];
}
function translate(group,x,lift){
 group.frame.x+=x;group.frame.baseY+=x*lift;
 for(const stroke of group.movements)for(const p of stroke.points){p.x+=x;p.y+=x*lift;}
}
export function spaceWord(groups,{unit,ratio,weight,lift,joinChance}){
 const pairs=[];let carry=0;
 const connected=joinChance>.6,target=weight*2*.55*(connected?.2:1)+unit*(connected?.1:.3),maximum=unit*ratio;
 for(let i=1;i<groups.length;i++){
  const left=groups[i-1],right=groups[i];translate(right,carry,lift);
  if(left.wordIndex!==right.wordIndex)continue;
  const gap=opticalGap(left,right);if(gap===null)continue;
  const shift=clamp(target-gap,-maximum,maximum);translate(right,shift,lift);carry+=shift;
  pairs.push({from:left.index,to:right.index,before:gap,after:opticalGap(left,right),target,shift,maximum});
 }
 return {pairs,shift:carry};
}
