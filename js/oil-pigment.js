// Oil V5 colour model, developed from Claude's pigment.js.
// An art-directed gamut and three-channel K/S approximation, not measured
// pigment spectra. Oklab matrices: https://bottosson.github.io/posts/oklab/
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const linear=v=>{v=clamp(v/255);return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
const srgb=v=>Math.round(255*(v<=.0031308?12.92*clamp(v):1.055*clamp(v)**(1/2.4)-.055));
function toLab(rgb){
 const [r,g,b]=rgb.map(linear);
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),
  m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),
  s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,
  1.9779984951*l-2.428592205*m+.4505937099*s,
  .0259040371*l+.7827717662*m-.808675766*s];
}
function fromLab([L,a,b]){
 const l=(L+.3963377774*a+.2158037573*b)**3,
  m=(L-.1055613458*a-.0638541728*b)**3,
  s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,
  -1.2684380046*l+2.6097574011*m-.3413193965*s,
  -.0041960863*l-.7034186147*m+1.707614701*s];
}
function gamut(L,C,h){
 // Reduce chroma at fixed hue/lightness instead of clipping RGB channels.
 const at=c=>fromLab([L,c*Math.cos(h),c*Math.sin(h)]);
 const inside=c=>c.every(v=>v>=-1e-7&&v<=1.0000001);
 let c=at(C);
 if(!inside(c)){
  let lo=0,hi=C;
  for(let i=0;i<18;i++){
   const mid=(lo+hi)/2;
   if(inside(at(mid)))lo=mid;else hi=mid;
  }
  c=at(lo);
 }
 return c.map(srgb);
}
// Continuous hue anchors replace the prototype's abrupt 70/120/200/300 cuts.
// Yellow keeps a high, bright cusp; blue keeps its deeper saturated mass tone.
// Values are aesthetic targets, not claims about a particular tube of paint.
const anchors=[
 [0,.63,.19],[35,.67,.20],[70,.77,.19],[100,.88,.19],
 [125,.84,.19],[155,.66,.18],[195,.64,.17],[235,.55,.17],
 [270,.46,.19],[305,.55,.19],[335,.62,.19],[360,.63,.19]
];
function cusp(h){
 const deg=(h*180/Math.PI+360)%360;
 let i=0;while(i<anchors.length-2&&deg>anchors[i+1][0])i++;
 const a=anchors[i],b=anchors[i+1],t=smooth((deg-a[0])/(b[0]-a[0]));
 return [lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
}
function mapRGB(rgb){
 const [L,a,b]=toLab(rgb),C=Math.hypot(a,b),h=Math.atan2(b,a);
 // No universal darkening or warm hue rotation: greys/white retain identity.
 if(C<.0001)return rgb.map(v=>Math.round(clamp(v,0,255)));
 const [peakL,peakC]=cusp(h),
  position=L<peakL?L/peakL:(1-L)/(1-peakL),
  cap=peakC*Math.max(0,position)**.72,
  knee=cap*.76;
 // A soft shoulder keeps distinct high-chroma source colours distinct.
 const mapped=C<=knee?C:knee+(cap-knee)*(1-Math.exp(-(C-knee)/Math.max(.00001,cap-knee)));
 return gamut(L,mapped,h);
}
function claudeRGB(rgb){
 // Original uploaded algorithm, preserved as a comparison reference.
 const [light,a,b]=toLab(rgb),hue=Math.atan2(b,a),deg=(hue*180/Math.PI+360)%360,
  peakL=deg>70&&deg<120?.86:deg>=120&&deg<200?.62:deg>=200&&deg<300?.48:.6,
  peakC=deg>70&&deg<120?.17:deg>=200&&deg<300?.16:.15,
  t=light<peakL?(light-.15)/(peakL-.15):(.98-light)/(.98-peakL),
  C=Math.min(Math.hypot(a,b),peakC*clamp(t)+.015),
  h=hue+Math.atan2(Math.sin(1.25-hue),Math.cos(1.25-hue))*.06;
 return fromLab([light*.97,C*Math.cos(h),C*Math.sin(h)]).map(srgb);
}
function mix(a,b,t){
 t=clamp(t);
 if(t===0)return a.slice();if(t===1)return b.slice();
 if(a.every((v,i)=>v===b[i]))return a.slice();
 const la=toLab(a),lb=toLab(b),
  ca=Math.hypot(la[1],la[2]),cb=Math.hypot(lb[1],lb[2]);
 // White needs a separate tint response: naive RGB K/S turns deep blue +
 // white nearly black. Blend toward a perceptual tint for light neutrals.
 const whiteA=smooth((la[0]-.78)/.18)*(1-smooth((ca-.025)/.06)),
  whiteB=smooth((lb[0]-.78)/.18)*(1-smooth((cb-.025)/.06)),
  tint=Math.max(whiteA,whiteB),
  // Approximate tint strength: dark/chromatic paint resists dilution.
  sa=1+.8*ca+.35*(1-la[0]),sb=1+.8*cb+.35*(1-lb[0]),
  u=t*sb/((1-t)*sa+t*sb),
  perceptual=fromLab(la.map((v,i)=>lerp(v,lb[i],u))),
  aa=a.map(linear),bb=b.map(linear);
 return aa.map((v,i)=>{
  const x=Math.max(.002,v),y=Math.max(.002,bb[i]),
   k=(1-u)*(1-x)**2/(2*x)+u*(1-y)**2/(2*y),
   // Stable equivalent of 1+k-sqrt(k*k+2*k).
   reflectance=1/(1+k+Math.sqrt(k*k+2*k));
  return srgb(lerp(reflectance,perceptual[i],tint));
 });
}
function tone(a,b,t){
 // Small bristle/value variations are tonal adjustments, not equal-volume
 // paint mixtures. Perceptual interpolation avoids dark K/S speckling.
 t=clamp(t);
 if(t===0)return a.slice();if(t===1)return b.slice();
 const x=toLab(a),y=toLab(b),v=x.map((n,i)=>lerp(n,y[i],t));
 return gamut(v[0],Math.hypot(v[1],v[2]),Math.atan2(v[2],v[1]));
}
function createModel(reference=false){
 const cache=new Map(),stats={mappedColours:0,cacheHits:0,mixes:0,tones:0};
 return {
  name:reference?'claude-palette':'oil-pigment-v5',stats,
  mapRGB(rgb){
   const key=rgb.join(',');let result=cache.get(key);
   if(result)stats.cacheHits++;
   else{
    result=(reference?claudeRGB:mapRGB)(rgb);stats.mappedColours++;
    if(cache.size>=512)cache.clear();cache.set(key,result);
   }
   return result.slice();
  },
  mix:reference?null:(a,b,t)=>{stats.mixes++;return mix(a,b,t)},
  tone:reference?null:(a,b,t)=>{stats.tones++;return tone(a,b,t)}
 };
}
A.oilPigment={toLab,fromLab,mapRGB,claudeRGB,mix,tone,cusp,createModel};
})(window.AlgoArt);
