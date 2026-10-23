// Archive-faithful material and renderer identification for 3D editions.
// Source SVG captures the baseline marker composition, NOT the final material
// render for tissue, watercolour, oil or action painting. Do not treat those
// SVG strokes as a complete outline of the material-specific paint.
const MATERIALS=Object.freeze(['marker','tissue','watercolour','oil','action']);
const PROFILES=Object.freeze({
  marker:Object.freeze({
    geometry:'recorded-strokes',
    surface:'ink',depthMode:'raised-lines',roughness:.78,opacity:1,
    note:'Retain stroke centre-lines, dash, pen pressure, pigment and cap width.'
  }),
  tissue:Object.freeze({
    geometry:'composition-plus-material-render',
    surface:'tissue-graphite',depthMode:'layered-cutouts',roughness:.94,opacity:.72,
    note:'Thin translucent overlapping tissue and separate graphite relief.'
  }),
  watercolour:Object.freeze({
    geometry:'composition-plus-material-render',
    surface:'pigment-paper',depthMode:'shallow-washes',roughness:.96,opacity:.84,
    note:'Pigment bleeds and wash boundaries come from material output, not just stroke SVG.'
  }),
  oil:Object.freeze({
    geometry:'material-render-required',
    surface:'oil-bristle',depthMode:'thick-relief',roughness:.43,opacity:1,
    note:'Actual colour masses, bristle deposits and ridges can differ from marker SVG.'
  }),
  action:Object.freeze({
    geometry:'material-render-required',
    surface:'splatter-pools',depthMode:'variable-paint-drops',roughness:.51,opacity:1,
    note:'Paint pools, throws, spills and droplets extend beyond recorded marker paths.'
  })
});
export function resolveStudyMaterial(href,galleryMaterial='marker'){
  const url=new URL(href,'https://southernadd-cmyk.github.io/algoart/');
  const params=url.searchParams;
  const explicit=params.get('material')||'';
  const dataType=galleryMaterial==='watercolor'?'tissue':galleryMaterial;
  let type=MATERIALS.includes(dataType)?dataType:'marker';
  let revision='marker';
  if(/^action-v[12]$/.test(explicit)){type='action';revision=explicit;}
  else if(/^oil-v[1-4]$/.test(explicit)){type='oil';revision=explicit;}
  else if(/^watercolour-v2[rst]$/.test(explicit)){type='watercolour';revision=explicit;}
  else if(params.has('tissue')||params.has('watercolor')||params.has('oil')){
    type='tissue';
    const n=params.get('tissue')||params.get('watercolor')||params.get('oil');
    revision='tissue-'+n;
  }else if(type!=='marker')revision='unspecified';
  const v=Number(params.get('v'));
  const rendererVersion=Number.isInteger(v)&&v>=1&&v<=9?v:null;
  return Object.freeze({
    type,revision,rendererVersion,
    seed:params.get('seed')||null,
    mode:params.get('mode')||null,
    orientation:params.get('fmt')==='portrait'?'portrait':'landscape',
    phiSheetFraming:params.get('sheet')==='phi',
    legacyMaterialFit:params.get('fit')==='1',
    params:Object.freeze(Object.fromEntries(params)),
    sourceUrl:url.href,
    profile:PROFILES[type],
    svgScope:'baseline-composition-only',
    exactMaterialShapesAvailableFromSvg:type==='marker'
  });
}
export function materialProfile(type){
  return PROFILES[type]||PROFILES.marker;
}
