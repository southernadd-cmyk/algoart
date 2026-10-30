// A day's material version is frozen so queued/social/archive images replay
// identically after a studio default changes. Today's generated V4 stays V4.
export const OIL_PIGMENT_CUTOVER='2026-10-26';
export const OIL_OPAQUE_CUTOVER='2026-10-26';
export const OIL_V7_CUTOVER='2026-10-31';
export function oilVersionForDate(day){
  return day>=OIL_V7_CUTOVER?'oil-v7':day>=OIL_OPAQUE_CUTOVER?'oil-v6':day>=OIL_PIGMENT_CUTOVER?'oil-v5':day>='2026-10-17'?'oil-v4':'oil-v1';
}

