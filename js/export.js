window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';

// Retain each connected download anchor until Android/iOS has consumed its
// blob URL. Removing it immediately after click can make subsequent downloads
// appear stuck in mobile WebViews until the document is refreshed.
var downloadCounts=Object.create(null);
A.downloadBlob=function(blob,filename){
  if(!blob||!blob.size)throw new Error('Export file could not be encoded.');
  var count=(downloadCounts[filename]||0)+1;
  // Android's download UI can collapse repeated downloads with identical
  // filenames. Give consecutive exports separate filenames, like (2).png.
  var name=count===1?filename:filename.replace(/(\.[^./]+)$/, ' ('+count+')$1');
  var url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;
  link.style.position='fixed';link.style.left='-10000px';
  link.style.width='1px';link.style.height='1px';
  document.body.appendChild(link);
  try{
    link.click();
    downloadCounts[filename]=count;
  }finally{
    setTimeout(function(){
      link.remove();
      URL.revokeObjectURL(url);
    },60000);
  }
  return name;
};

A.preparePNG=function(settings,scale){
  scale=Number(scale)||1;
  var pixels=(settings.orientation==='portrait'?1000:1400)*
    (settings.orientation==='portrait'?1400:1000)*scale*scale;
  if(!Number.isFinite(scale)||scale<1||pixels>14000000)
    return Promise.reject(new Error('PNG resolution is too large. Choose a smaller size.'));
  var out=document.createElement('canvas');
  var compositionSettings=Object.assign({},settings);
  delete compositionSettings.actionPaintingRender;
  delete compositionSettings.actionPaintingRevision;
  delete compositionSettings.oilRender;
  delete compositionSettings.oilPaintRender;
  delete compositionSettings.oilPaintRevision;
  delete compositionSettings.watercolourRender;
  delete compositionSettings.watercolourRevision;
  delete compositionSettings.watercolourFitToSheet;
  delete compositionSettings.tissuePaletteVersion;
  var filename='algoart-'+settings.seed+'-'+settings.mode+
    (settings.orientation==='portrait'?'-portrait':'')+
    (settings.actionPaintingRender?'-action-v'+(settings.actionPaintingRevision||2):settings.oilPaintRender?'-oil-paint-'+(settings.oilPaintRevision||'v1'):settings.watercolourRender?'-watercolour-'+(settings.watercolourRevision||'v2r'):settings.oilRender?'-tissue-graphite':'')+'-'+scale+'x.png';
  // Paint synchronously but encode off the main thread where supported.
  // This avoids holding a very large PNG data URL and its base64 clone.
  return new Promise(function(resolve,reject){
    try{
      if(settings.actionPaintingRender){
        const actionVersion=Number(settings.actionPaintingRevision)||2;
        (actionVersion===4?A.renderActionPaintingV4:actionVersion===3?A.renderActionPaintingV3:A.renderActionPainting)(out,compositionSettings,scale,false,{version:actionVersion});
      }
      else if(settings.oilPaintRender){
        const oilRenderer=settings.oilPaintRevision==='v7'?A.renderOilPaintV7:
          settings.oilPaintRevision==='v6'?A.renderOilPaintV6:
           settings.oilPaintRevision==='v5'?A.renderOilPaintV5:
          settings.oilPaintRevision==='v4'?A.renderOilPaintV4:
          settings.oilPaintRevision==='v3'?A.renderOilPaintV3:
          settings.oilPaintRevision==='v2'?A.renderOilPaintV2:A.renderOilPaintV1;
        oilRenderer(out,compositionSettings,scale,false);
      }
      else if(settings.watercolourRender){
        if(settings.watercolourRevision==='v2s'||settings.watercolourRevision==='v2t'){
          var previousFit=A.watercolourV2sOptions.fitToSheet;
          try{
            A.watercolourV2sOptions.fitToSheet=settings.watercolourFitToSheet!==false;
            (settings.watercolourRevision==='v2t'?A.renderWatercolourV2T:
              A.renderWatercolourV2S)(out,compositionSettings,scale,false);
          }finally{
            A.watercolourV2sOptions.fitToSheet=previousFit;
          }
        }
        else A.renderWatercolourV2R(out,compositionSettings,scale,false);
      }
      else if(settings.oilRender&&settings.tissuePaletteVersion===8)
        A.renderTissueV8(out,compositionSettings,scale,false);
      else if(settings.oilRender)
        A.renderOil(out,compositionSettings,scale,false,settings.tissuePaletteVersion>=2?settings.tissuePaletteVersion:1);
      else A.render(out,compositionSettings,scale,false);
      if(typeof out.toBlob!=='function')
        throw new Error('This browser cannot encode PNG downloads.');
      out.toBlob(function(blob){
        // Release the offscreen raster as soon as encoding completes.
        out.width=1;out.height=1;
        if(!blob){reject(new Error('PNG encoding failed. Try 1× resolution.'));return}
        try{resolve({filename:filename,bytes:blob.size,blob:blob})}
        catch(error){reject(error)}
      },'image/png');
    }catch(error){
      out.width=1;out.height=1;reject(error);
    }
  });
};

// Desktop retains its one-click download. Mobile presents the prepared file
// as a real link so Chrome receives the user's tap on the download itself.
A.exportPNG=function(settings,scale){
  return A.preparePNG(settings,scale).then(function(file){
    A.downloadBlob(file.blob,file.filename);
    return {filename:file.filename,bytes:file.bytes};
  });
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
    if(p.transform)attrs.push('transform="'+esc(p.transform)+'"');
    if(p.dash&&p.dash.length){
      attrs.push('stroke-dasharray="'+p.dash.map(function(v){return v.toFixed(2)}).join(' ')+'"');
      attrs.push('stroke-dashoffset="'+Number(p.dashOffset||0).toFixed(2)+'"');
    }
    body.push('<path '+attrs.join(' ')+'/>');
  });

  var meta=esc(JSON.stringify({
    seed:settings.seed,
    mode:settings.mode,
    orientation:settings.orientation||'landscape',
    phiStrength:settings.phiStrength,
    generator:'PROPORTION PIECE'
  }));

  var svg=[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+A.W+'" height="'+A.H+'" viewBox="0 0 '+A.W+' '+A.H+'">',
    '<metadata>'+meta+'</metadata>',
    body.join(''),
    '</svg>'
  ].join('');

  var blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  A.downloadBlob(blob,'algoart-'+settings.seed+'-'+settings.mode+
    (settings.orientation==='portrait'?'-portrait':'')+'.svg');
};

})(window.AlgoArt);


