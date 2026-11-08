// Confluence-specific spatial equity when a Recursive Divisions hand shares
// the paper with other systems. Turn shares stay φ-weighted: these rules
// prevent a large frame from functioning as a wall around the other voices.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GOLD=Math.PI*(3-Math.sqrt(5));

// Limit the spatial *footprint*, not the number of genuine rectangle marks.
// Only applies to mixed-system collaborations; the untouched solo renderer
// and historical saved artworks are not involved.
export function capRectangleFootprint(groups,pose,anchor,sheet,pull,rectCount=1){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const group of groups)for(const probe of group.probes||[]){
    const p=pose(probe.p);
    minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
  }
  const area=(maxX-minX)*(maxY-minY);
  if(!Number.isFinite(area)||area<=0)return pose;
  const target=clamp(.72-.17*pull/100-.08*(rectCount-1),.40,.72);
  const scale=Math.min(1,Math.sqrt(target*sheet.width*sheet.height/area));
  if(scale>=.999)return pose;
  return point=>{
    const p=pose(point);
    return {x:anchor.x+(p.x-anchor.x)*scale,
      y:anchor.y+(p.y-anchor.y)*scale};
  };
}

// Interior destinations come from the original *actual* Recursive Divisions
// cell guide, transformed to the shared paper, rather than invented φ tiles.
export function rectangleInteriors(artists,sheet){
  const cells=[],seen=new Set();
  for(const artist of artists){
    if(artist.system!=='rects')continue;
    for(const group of artist.groups){
      if(group.info?.section!=='cells'||!group.cell)continue;
      const c=group.cell;
      const a=artist.pose.place({x:c.x,y:c.y});
      const b=artist.pose.place({x:c.x+c.w,y:c.y+c.h});
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
      const w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
      if(w<84||h<72||w*h>sheet.width*sheet.height*.48)continue;
      const key=[artist.id,Math.round(x),Math.round(y),Math.round(w),Math.round(h)].join(':');
      if(seen.has(key))continue;
      seen.add(key);
      cells.push({id:key,x,y,w,h,area:w*h});
    }
  }
  return cells.sort((a,b)=>b.area-a.area).slice(0,16);
}

// Move only independent responding groups into cells; don't tear apart a
// linked network or an established branch. The entire native mark is scaled
// and translated, preserving its genuine proportions and relative geometry.
export function interiorCandidates(group,artist,cells,turn,used=new Map()){
  if(!cells.length||!(group.probes?.length))return [];
  const fixed=(group.links||[]).some(p=>artist.anchors.has(p.x.toFixed(4)+','+p.y.toFixed(4)));
  if(fixed)return [];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const trace of group.traces)for(const p of trace.points){
    const q=artist.pose.place(p);
    minX=Math.min(minX,q.x);minY=Math.min(minY,q.y);
    maxX=Math.max(maxX,q.x);maxY=Math.max(maxY,q.y);
  }
  const center=artist.pose.place(group.center);
  const width=Math.max(1,maxX-minX),height=Math.max(1,maxY-minY);
  const options=[];
  for(let i=0;i<cells.length;i++){
    const cell=cells[i];
    const scale=Math.min(1,cell.w*.67/width,cell.h*.67/height);
    if(scale<.06)continue;
    const angle=(turn*.23+artist.number+i)*GOLD;
    const x=cell.x+cell.w*(.5+Math.cos(angle)*.065);
    const y=cell.y+cell.h*(.5+Math.sin(angle)*.065);
    options.push({
      place:point=>{
        const p=artist.pose.place(point);
        return {x:x+(p.x-center.x)*scale,y:y+(p.y-center.y)*scale};
      },
      effort:.65,rectCellId:cell.id,used:used.get(cell.id)||0,
      insideRect:true
    });
  }
  return options;
}
