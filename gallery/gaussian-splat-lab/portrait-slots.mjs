// The shared curator may swap portrait IDs across painting/sculpture slots.
// Repair only the experimental lab, preserving all wall and pedestal coordinates.
export function isSoloPortrait(study){
  return !!study?.portrait && study.material!=='confluence' && study.material?.type!=='confluence';
}
export function repairPortraitSlots(exhibition,studies){
  const byId=new Map(studies.map(s=>[s.id,s]));
  const wrongPaintings=exhibition.paintings.filter(p=>isSoloPortrait(byId.get(p.studyId)));
  const wrongSculptures=exhibition.sculptures.filter(p=>!isSoloPortrait(byId.get(p.studyId)));
  if(wrongPaintings.length!==wrongSculptures.length)throw Error('Portrait display slot counts do not match the archive');
  for(let i=0;i<wrongPaintings.length;i++){
    const a=wrongPaintings[i],b=wrongSculptures[i];
    if(!byId.get(b.studyId)?.portrait)throw Error('Unexpected non-portrait sculpture assignment');
    [a.studyId,b.studyId]=[b.studyId,a.studyId];
    const aspect=Number(byId.get(a.studyId).aspect)||1/1.4;
    if(Math.abs(a.width/a.height-aspect)>1e-6)throw Error('Cannot safely repair differently sized portrait slots');
  }
  const all=[...exhibition.paintings,...exhibition.sculptures];
  if(all.length!==studies.length||new Set(all.map(p=>p.studyId)).size!==studies.length||all.some(p=>!byId.has(p.studyId)))throw Error('Archive display assignments are incomplete');
  return wrongPaintings.length;
}
