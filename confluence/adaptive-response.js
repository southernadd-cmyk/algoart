// The response is not an artist setting. Infer it for EACH turn from the
// previous artists' marks and the full-sheet pigment occupancy field.
// No random mode selection: the same preceding drawing always yields the
// same reaction, including during Replay and the equal-turn comparison.
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const CELL=16;
const REACH=144;

/**
 * Infer where this group should respond: align with a nearby drawing,
 * weave alongside it, or protect existing dense pigment.
 * Fields are maintained by mark-planner and the material-aware deposition
 * pass; density includes physical wash/paint footprints where available.
 */
export function inferResponse(group,artist,fields,density,sheet){
  const probes=group?.probes||[];
  if(!probes.length) return {
    mode:'weave',response:{gap:40,overlap:2.3,alignment:.14},
    evidence:{near:0,aligned:0,load:0,close:0}
  };
  let count=0,near=0,close=0,aligned=0,load=0;
  const stride=Math.max(1,Math.floor(probes.length/16));
  for(let i=0;i<probes.length;i+=stride){
    const probe=probes[i];
    const point=artist.pose.place(probe.p);
    const next=artist.pose.place(probe.next);
    const heading=Math.atan2(next.y-point.y,next.x-point.x);
    const x=clamp(Math.floor(point.x/CELL),0,sheet.cols-1);
    const y=clamp(Math.floor(point.y/CELL),0,sheet.rows-1);
    const index=x+y*sheet.cols;
    let closest=REACH,angle=0;
    for(const field of fields){
      const distance=field.distances[index];
      if(distance<closest){closest=distance;angle=field.angle[index];}
    }
    const pigment=Math.max(0,density?.at(point)||0);
    load+=Math.min(3,pigment);
    if(closest<110){
      near++;
      aligned+=Math.abs(Math.cos(heading-angle))*(1-closest/180);
    }
    if(closest<32)close++;
    count++;
  }
  const nearRatio=near/count,closeRatio=close/count,loadAverage=load/count;
  const directionAgreement=near?aligned/near:0;
  // Strong local pigment calls for negative space; directional agreement
  // produces an echo where the sheet has room. Otherwise weave around marks.
  const reserve=clamp((loadAverage-.35)/1.4+closeRatio*.55,0,1);
  const echo=clamp((directionAgreement-.25)*1.5,0,1)*nearRatio*(1-reserve);
  const mode=reserve>=.48?'space':echo>=.40?'echo':'weave';
  return {
    mode,
    response:{
      gap:40+80*reserve-18*echo,
      overlap:2.3+1.1*reserve-1.3*echo,
      alignment:Math.max(0,.14*(1-reserve)+1.06*echo)
    },
    evidence:{near:nearRatio,aligned:directionAgreement,load:loadAverage,close:closeRatio}
  };
}
