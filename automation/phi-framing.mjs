// Deliberate non-retroactive introduction of the optional shared φ
// composition frame to automated daily studies. The cutoff is London-local;
// every pipeline already supplies SOCIAL_DATE in YYYY-MM-DD UK date form.
// Existing archived art and published media must retain their original URLs.
export const DAILY_PHI_SHEET_START_DATE='2026-10-15';

export function dailyPhiFramingForDate(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day)))
    throw new Error('Invalid daily artwork date: '+day);
  return day>=DAILY_PHI_SHEET_START_DATE;
}

export function appendDailyPhiFraming(query,day){
  if(!dailyPhiFramingForDate(day))return query;
  const params=new URLSearchParams(query);
  params.set('sheet','phi');
  return params.toString();
}
