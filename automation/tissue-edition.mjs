// Public naming changed from Watercolor to Tissue & Graphite.
// Keep the historical internal queues/IDs named "watercolor" permanently.
// Only newly generated editions from 14 October 2026 use seeded colour + graphite v3.
export const SEEDED_TISSUE_START_DATE='2026-10-14';

export function tissueEditionForDate(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||
     !Number.isFinite(Date.parse(String(date)+'T12:00:00Z'))||
     new Date(String(date)+'T12:00:00Z').toISOString().slice(0,10)!==String(date)){
    throw new Error('Invalid Tissue & Graphite edition date: '+date);
  }
  const seeded=String(date)>=SEEDED_TISSUE_START_DATE;
  return {
    edition:seeded?'seeded':'historical',
    param:seeded?'tissue':'watercolor',
    value:seeded?'3':'1',
    suffix:seeded?'&tissue=3':'&watercolor=1'
  };
}
export function validateTissueShareUrl(date,shareUrl){
  const expected=tissueEditionForDate(date);
  const u=new URL(shareUrl);
  const hasLegacy=u.searchParams.has('watercolor')||u.searchParams.has('oil');
  const hasSeeded=u.searchParams.has('tissue');
  if((hasLegacy&&hasSeeded)||u.searchParams.get(expected.param)!==expected.value||
     (expected.edition==='historical'&&hasSeeded)||
     (expected.edition==='seeded'&&hasLegacy)){
    throw new Error('Tissue & Graphite material revision disagrees with '+date+': '+shareUrl);
  }
  return expected;
}
