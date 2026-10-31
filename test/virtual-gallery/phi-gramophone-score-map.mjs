// Test-only, exact-recording alignment evidence. The audio is not modified.
// Each number is the start time in seconds for a canonical written score bar.
// Scores: DCMLab debussy_images (corrected using WJEC's 94-bar original);
// DCMLab mozart_piano_sonatas (73 bars, first movement, NO repeat played).
// Matched by two distinct methods: free chroma CQT/DTW and tempo-constrained
// CQT/DTW. Stored time uses the constrained candidate. differences[] records
// their absolute disagreement at each bar; >2 s = unverified, not seekable.
// Source note dataset: CC BY-NC-SA 4.0; alignment computed for PROPORTION PIECE.
export const GRAMOPHONE_SCORE_MAP=Object.freeze({
 './audio/debussy-reflets-dans-leau.ogg':Object.freeze({
  duration:332.875,
  sha256:'3c8c436cda4efa2fd6af616ef14394d002194c94652c8b3517fe2b1eab57647d',
  scoreBars:94,repeat:'unrepeated',
  citation:'https://github.com/DCMLab/debussy_images',
  editorialNote:'WJEC/Durand: two transcribed measures at bar 23 form one bar in the 94-bar original.',
  starts:Object.freeze([0,7.01,11.11,15.2,17.83,22.21,25.43,28.93,32.59,37.12,40.62,43.69,48.51,53.48,56.99,60.06,64.88,69.12,72.77,78.03,81.1,82.85,85.05,88.99,90.74,94.4,97.47,100.1,101.85,104.48,107.99,111.49,115.44,119.24,124.21,129.91,134,137.07,140.57,143.64,147.59,150.66,152.85,156.36,158.55,160.74,162.93,165.12,168.19,169.94,172.58,175.21,177.4,180.47,182.66,184.56,186.75,188.94,191.57,194.64,196.39,199.9,202.09,204.28,209.54,214.51,218.9,225.62,229.71,236.43,242.28,248.12,251.63,255.14,257.77,261.86,264.05,268,270.63,275.89,280.42,283.48,286.99,289.18,291.38,293.71,298.24,301.31,303.94,306.57,309.79,313.29,317.68,324.69]),
  differences:Object.freeze([0,0.93,0.31,1.45,1.3,0.59,0.34,1.99,2.03,0.5,0.67,0.89,0.03,0.03,0.57,0.59,1.16,1.84,0.7,0.08,0.12,0.05,0.16,7.79,6.23,2.94,0.38,2.72,1.62,0.08,3.98,4.75,1.77,0.11,2.2,0.73,0.16,1.84,0.51,5.52,2.5,0.13,0.68,1.81,0,0.13,0.02,0.07,2.77,4.15,5.95,0.43,1.25,0.19,2.01,0.1,0.87,0.12,0.6,0.96,0.79,0.49,0.3,0.06,0.69,0.09,2.53,1.61,0.12,5.15,3.2,1.87,0.3,1.02,0.4,1.18,0.56,1.06,1.93,0.52,0.82,0.31,0.04,0.23,0.17,0.9,0.28,1.34,1.26,4.02,13.34,16.15,14.37,7.73])
 }),
 './audio/mozart-k545-allegro.ogg':Object.freeze({
  duration:133.878,
  sha256:'27c63f441129af6d244714a2d3fff5a427b5cb46bcf362137ee0fff29bc0fa50',
  scoreBars:73,repeat:'no_repeats',
  citation:'https://github.com/DCMLab/mozart_piano_sonatas',
  editorialNote:'This 2:14 performance omits both written repeats.',
  starts:Object.freeze([0,3.66,5.5,7.25,8.89,10.38,12.06,13.66,15.49,17.17,18.85,20.42,22.75,24.35,25.84,27.74,29.39,31.1,32.97,34.77,36.68,38.51,40.22,42.06,44.65,45.57,47.4,49.12,51.6,53.09,54.76,56.56,58.31,59.95,61.63,63.35,65.18,67.02,68.73,70.68,72.55,74.65,76.71,78.62,80.52,82.32,84.04,85.64,87.39,89.07,90.64,92.51,94.26,95.79,97.62,99.26,100.94,103.31,104.68,106.51,108.38,110.14,111.86,113.42,115.64,117.43,119.3,121.21,122.92,124.76,126.24,128.19,129.98]),
  differences:Object.freeze([0,0.06,0.02,0.05,0.12,0.02,0.08,0.09,0.07,0.01,0.05,0.01,0.01,0.02,0.12,0.12,0.1,0.11,0,0.06,0.1,0.08,0.1,0.01,0.49,0.03,0.08,0.01,0.04,0.1,0.04,0,0.03,0.05,0.04,0.09,0.07,0.1,0,0,0.08,0.03,0.01,0.23,0.1,0.11,0.06,0.18,0.04,0.05,0.04,0.09,0.01,0.02,0.1,0.03,0.02,0.4,0.18,0.16,0.06,0.11,0.06,0.17,0.09,0.03,0,0,0.05,0.02,0.03,0.02,0.04])
 })
});

export function alignedScorePoint(src,fraction,audioDuration,{maximumDisagreement=2}={}){
 const map=GRAMOPHONE_SCORE_MAP[src];
 if(!map||!Number.isFinite(fraction)||fraction<0||fraction>1||
  !Number.isFinite(audioDuration)||Math.abs(audioDuration-map.duration)>.55||
  map.starts.length!==map.scoreBars||map.differences.length!==map.scoreBars)return null;
 const completed=fraction*map.scoreBars;
 const i=Math.min(map.scoreBars-1,Math.floor(completed));
 const w=Math.max(0,Math.min(1,completed-i));
 const next=i+1<map.scoreBars?map.starts[i+1]:map.duration;
 const time=map.starts[i]*(1-w)+next*w;
 const diff0=map.differences[i];
 const diff1=i+1<map.scoreBars?map.differences[i+1]:map.differences[i];
 const disagreement=diff0*(1-w)+diff1*w;
 // Both neighbouring score-bar anchors must agree: an interpolated average
 // must never hide one grossly misaligned boundary. This certifies agreement
 // between automated methods, NOT a human-audited musical correspondence.
 const verified=diff0<=maximumDisagreement&&diff1<=maximumDisagreement;
 return {fraction,time,completedBars:completed,
  withinBar:i+1,scoreBars:map.scoreBars,disagreement,verified,
  confidence:verified?(disagreement<=.5?'strong':'moderate'):'needs-review',
  source:map.citation,editorialNote:map.editorialNote};
}
