// Published downbeat timestamps from ASAP v1.1's MAESTRO 2008 Kleisen11M
// performance of Debussy, Reflets dans l’eau. These 94 downbeats are recorded
// performance timestamps (seconds), not an estimated interpolation of another
// pianist's music. The selected .ogg is transcoded from the MATCHING WAV.
// CC BY-NC-SA 4.0, (c) ASAP authors and MAESTRO dataset contributors.
// https://github.com/fosfrancesco/asap-dataset
// https://magenta.tensorflow.org/datasets/maestro
export const ASAP_DEBUSSY_SOURCE='./audio/debussy-reflets-asap-kleisen.ogg';
export const ASAP_DEBUSSY_SCORE_BARS=94;
export const ASAP_DEBUSSY_DOWNBEATS=Object.freeze([0.916667,4.294271,7.247396,9.755208,13.158854,16.266927,19.110677,21.609375,24.746094,28.561198,31.953125,34.134115,37.927083,41.147787,44.285807,49.890625,52.33724,55.807291,58.85026,62.580729,64.639323,66.248698,67.903646,69.8125,73.533854,75.520834,77.56901,79.585938,81.885417,84.091146,85.783855,88.760417,91.721354,95.231771,98.602865,101.846354,105.110677,108.134115,110.670573,113.625,116.43099,119.223958,121.632812,124.675781,127.050781,129.138021,131.145833,133.054688,134.889323,136.78776,138.785156,141.366536,144.021484,145.88151,147.710938,150.125,152.403646,155.397135,157.364583,160.179688,162.666667,166.139323,168.686198,172.179688,175.863281,181.016927,186.182291,191.169271,197.647135,202.996745,208.64388,212.889323,215.684896,218.428385,221.057291,223.888021,226.8125,229.998698,232.716146,236.68099,240.111979,244.199219,247.56836,251.042969,253.25651,255.470052,258.845703,262.549479,265.372396,267.722656,269.95638,273.898438,276.371838,277.923177]);
export const ASAP_DEBUSSY_LAST_BEAT=281.210938;

export function asapDebussyScorePoint(src,fraction,audioDuration){
 if(src!==ASAP_DEBUSSY_SOURCE||!Number.isFinite(fraction)||fraction<0||fraction>1||
 !Number.isFinite(audioDuration)||audioDuration<ASAP_DEBUSSY_LAST_BEAT||
 audioDuration>ASAP_DEBUSSY_LAST_BEAT+8)return null;
 const completedBars=fraction*ASAP_DEBUSSY_SCORE_BARS;
 const i=Math.min(ASAP_DEBUSSY_SCORE_BARS-1,Math.floor(completedBars));
 const w=Math.max(0,Math.min(1,completedBars-i));
 const a=ASAP_DEBUSSY_DOWNBEATS[i];
 const b=i===ASAP_DEBUSSY_SCORE_BARS-1?audioDuration:ASAP_DEBUSSY_DOWNBEATS[i+1];
 return {time:a+(b-a)*w,fraction,completedBars,withinBar:i+1,
  scoreBars:ASAP_DEBUSSY_SCORE_BARS,verified:true,confidence:'published',
  evidence:'ASAP beat and downbeat annotations for this exact MAESTRO recording',
  source:'https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau'};
}
