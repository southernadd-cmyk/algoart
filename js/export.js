window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

A.exportPNG=function(settings,scale){
  scale=Number(scale)||1;
  var out=document.createElement('canvas');
  A.render(out,settings,scale,false);

  var link=document.createElement('a');
  link.download='algoart-'+settings.seed+'-'+settings.mode+'-'+scale+'x.png';
  link.href=out.toDataURL('image/png');
  link.click();
};

function esc(v){
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

A.exportSVG=function(settings){
  var out=document.createElement('canvas');
  A.svgRecorder={paths:[],background:settings.paper};
  A.render(out,settings,1,false);
  var rec=A.svgRecorder;
  A.svgRecorder=null;

  var body=['<rect width="100%" height="100%" fill="'+esc(rec.background||settings.paper)+'"/>'];

  rec.paths.forEach(function(p){
    var attrs=[
      'd="'+esc(p.d)+'"',
      'fill="none"',
      'stroke="'+esc(p.stroke)+'"',
      'stroke-width="'+p.width.toFixed(2)+'"',
      'stroke-opacity="'+p.opacity.toFixed(3)+'"',
      'stroke-linecap="'+esc(p.lineCap||'round')+'"',
      'stroke-linejoin="round"'
    ];
    if(p.dash&&p.dash.length){
      attrs.push('stroke-dasharray="'+p.dash.map(function(v){return v.toFixed(2)}).join(' ')+'"');
      attrs.push('stroke-dashoffset="'+Number(p.dashOffset||0).toFixed(2)+'"');
    }
    body.push('<path '+attrs.join(' ')+'/>');
  });

  var meta=esc(JSON.stringify({
    seed:settings.seed,
    mode:settings.mode,
    phiStrength:settings.phiStrength,
    generator:'ALGO/ART'
  }));

  var svg=[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+A.W+'" height="'+A.H+'" viewBox="0 0 '+A.W+' '+A.H+'">',
    '<metadata>'+meta+'</metadata>',
    body.join(''),
    '</svg>'
  ].join('');

  var blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var link=document.createElement('a');
  link.download='algoart-'+settings.seed+'-'+settings.mode+'.svg';
  link.href=url;
  link.click();
  setTimeout(function(){URL.revokeObjectURL(url)},1000);
};

})(window.AlgoArt);