// Material scripts are classic scripts on purpose. They extend the same
// window.AlgoArt namespace as the immutable historical renderers.
window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var revision='20261018-welcome-preload-v3';
var shared=['oil-surface','oil-material','oil-render'];
var watercolour=shared.concat(['watercolour-v2r','watercolour-v2s']);
var oil=shared.concat([
  'oil-v1-core-a','oil-v1-core-b','oil-v1-core-c','oil-paint-v1',
  'oil-brush-v2','oil-paint-v2','oil-brush-v3','oil-paint-v3'
]);
var loaded=new Set(),queue=Promise.resolve();
function dependencies(material,options){
  options=options||{};
  if(material==='marker')return [];
  if(material==='tissue')return options.tissueRevision===8?
    shared.concat(['cpu-canvas','cpu-material-versions']):shared;
  if(material==='watercolour')return options.watercolourRevision==='v2t'?
    watercolour.concat(['cpu-canvas','cpu-material-versions']):watercolour;
  if(material==='oil')return options.oilRevision==='v4'?
    oil.concat(['cpu-canvas','cpu-material-versions']):oil;
  if(material==='action')return ['action-painting-v1'];
  return Promise.reject(new Error('Unknown material: '+material));
}
function load(name){
  if(loaded.has(name))return Promise.resolve();
  return new Promise(function(resolve,reject){
    var script=document.createElement('script');
    script.src='js/'+name+'.js?v='+revision;
    script.async=false;
    script.onload=function(){loaded.add(name);resolve()};
    script.onerror=function(){
      script.remove();
      reject(new Error('Could not load material module '+name+'. Please check the connection and try again.'));
    };
    document.head.appendChild(script);
  });
}
A.materialScriptsReady=function(material,options){
  var files=dependencies(material,options);
  return Array.isArray(files)&&files.every(function(name){return loaded.has(name)});
};
A.ensureMaterialScripts=function(material,options){
  var files=dependencies(material,options);
  if(!Array.isArray(files))return files; // rejected promise
  if(files.every(function(name){return loaded.has(name)}))return Promise.resolve();
  // Serialize complete material chains so shared global assignments retain
  // precisely their historical order, even if a user changes selection mid-load.
  var task=queue.then(async function(){
    for(var name of files)await load(name);
  });
  queue=task.catch(function(){}); // One failed fetch must not poison retries.
  return task;
};
})(window.AlgoArt);
