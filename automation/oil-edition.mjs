// A day's material version is frozen so queued/social/archive images replay
// identically after a studio default changes. Today's generated V4 stays V4.
export const OIL_PIGMENT_CUTOVER='2026-10-26';
export function oilVersionForDate(day){
  return day>=OIL_PIGMENT_CUTOVER?'oil-v5':day>='2026-10-17'?'oil-v4':'oil-v1';
}
