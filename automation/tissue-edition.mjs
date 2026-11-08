// Internal watercolor IDs are permanent. Numeric tissue=8 is historical CPU V7.
// Layered Tissue V8 is explicitly material=tissue-v8.
export const SEEDED_TISSUE_START_DATE='2026-10-14';
export const SOURCE_MATCHED_TISSUE_START_DATE='2026-10-15';
export const LAYERED_TISSUE_V8_START_DATE='2026-11-09';
export function tissueEditionForDate(date){
 const day=String(date);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||
    !Number.isFinite(Date.parse(day+'T12:00:00Z'))||
    new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)
   throw Error('Invalid Tissue & Graphite edition date: '+day);
 const seeded=day>=SEEDED_TISSUE_START_DATE,layered=day>=LAYERED_TISSUE_V8_START_DATE;
 const param=layered?'material':seeded?'tissue':'watercolor';
 const value=layered?'tissue-v8':seeded?(day>=SOURCE_MATCHED_TISSUE_START_DATE?'7':'6'):'1';
 return {edition:seeded?'seeded':'historical',
   materialVersion:layered?'tissue-v8':'tissue-'+value,param,value,
   suffix:'&'+param+'='+value};
}
export function validateTissueShareUrl(date,shareUrl){
 const expected=tissueEditionForDate(date),p=new URL(shareUrl).searchParams;
 const legacy=p.has('watercolor')||p.has('oil'),tissue=p.has('tissue'),material=p.has('material');
 const valid=expected.param==='material'?
   p.get('material')==='tissue-v8'&&!tissue&&!legacy:
   expected.param==='tissue'?
     p.get('tissue')===expected.value&&!legacy&&!material:
     p.get('watercolor')==='1'&&!tissue&&!material&&!p.has('oil');
 if(!valid)throw Error('Tissue & Graphite material revision disagrees with '+date+': '+shareUrl);
 return expected;
}
