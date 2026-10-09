window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
var NS='http://www.inkscape.org/namespaces/inkscape';
function esc(v){return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function point(x,y){return{x:x,y:y}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function same(a,b){return distance(a,b)<1e-7}
function commands(d,transform){
  var tokens=d.match(/[MLC]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)||[],out=[],i=0;
  var matrix=transform?(transform.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)||[]).map(Number):null;
  function p(){
    var x=Number(tokens[i++]),y=Number(tokens[i++]);
    return matrix?point(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]):point(x,y);
  }
  while(i<tokens.length){
    var type=tokens[i++];
    if(type==='M'||type==='L')out.push({type:type,points:[p()]});
    else if(type==='C')out.push({type:type,points:[p(),p(),p()]});
    else throw Error('Unsupported plotter path command '+type);
  }
  return out;
}
function serialize(cmds){
  return cmds.map(function(c){return c.type+' '+c.points.map(function(p){return p.x+' '+p.y}).join(' ')}).join(' ');
}
function reversed(cmds){
  var segments=[],at=cmds[0].points[0];
  for(var i=1;i<cmds.length;i++){
    var c=cmds[i];segments.push({type:c.type,from:at,points:c.points});at=c.points[c.points.length-1];
  }
  var out=[{type:'M',points:[at]}];
  for(var j=segments.length-1;j>=0;j--){
    var seg=segments[j];
    out.push(seg.type==='C'?{type:'C',points:[seg.points[1],seg.points[0],seg.from]}:{type:'L',points:[seg.from]});
  }
  return out;
}
function midpoint(a,b){return point((a.x+b.x)/2,(a.y+b.y)/2)}
function pointLineDistance(p,a,b){
  var dx=b.x-a.x,dy=b.y-a.y;
  if(dx===0&&dy===0)return distance(p,a);
  return Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/Math.hypot(dx,dy);
}
function flatten(cmds){
  var out=[cmds[0].points[0]];
  function curve(a,b,c,d,depth){
    // Control-polygon excess also detects collinear backtracking.
    var excess=distance(a,b)+distance(b,c)+distance(c,d)-distance(a,d);
    if(depth>=18||(Math.max(pointLineDistance(b,a,d),pointLineDistance(c,a,d))<=.12&&excess<=.12)){
      out.push(d);return;
    }
    var ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d);
    var abc=midpoint(ab,bc),bcd=midpoint(bc,cd),centre=midpoint(abc,bcd);
    curve(a,ab,abc,centre,depth+1);curve(centre,bcd,cd,d,depth+1);
  }
  for(var i=1;i<cmds.length;i++){
    var c=cmds[i],a=out[out.length-1];
    if(c.type==='C')curve(a,c.points[0],c.points[1],c.points[2],0);
    else out.push(c.points[0]);
  }
  return out;
}
function clipped(a,b,w,h){
  var dx=b.x-a.x,dy=b.y-a.y,t0=0,t1=1;
  var ps=[-dx,dx,-dy,dy],qs=[a.x,w-a.x,a.y,h-a.y];
  for(var i=0;i<4;i++){
    if(ps[i]===0){if(qs[i]<0)return null;continue}
    var t=qs[i]/ps[i];
    if(ps[i]<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
    if(t0>t1)return null;
  }
  return[point(a.x+dx*t0,a.y+dy*t0),point(a.x+dx*t1,a.y+dy*t1)];
}
function cut(points,dash,offset,w,h){
  var pattern=dash&&dash.length?dash.slice():null;
  if(pattern&&pattern.length%2)pattern=pattern.concat(pattern);
  var index=0,left=Infinity;
  if(pattern){
    var period=pattern.reduce(function(a,b){return a+b},0);
    var phase=((offset||0)%period+period)%period;
    while(phase>=pattern[index]){phase-=pattern[index];index=(index+1)%pattern.length}
    left=pattern[index]-phase;
  }
  var runs=[],run=null;
  for(var i=1;i<points.length;i++){
    var a=points[i-1],b=points[i],length=distance(a,b),used=0;
    if(length<1e-10)continue;
    while(used<length-1e-10){
      var amount=Math.min(left,length-used),t0=used/length,t1=(used+amount)/length;
      var on=!pattern||index%2===0;
      var part=on?clipped(point(a.x+(b.x-a.x)*t0,a.y+(b.y-a.y)*t0),point(a.x+(b.x-a.x)*t1,a.y+(b.y-a.y)*t1),w,h):null;
      if(part&&distance(part[0],part[1])>1e-10){
        if(!run||!same(run[run.length-1],part[0])){run=[part[0]];runs.push(run)}
        run.push(part[1]);
      }else run=null;
      used+=amount;
      if(pattern){
        left-=amount;
        if(left<1e-9){index=(index+1)%pattern.length;left=pattern[index];if(index%2)run=null}
      }
    }
  }
  return runs;
}
function prepare(paths,w,h){
  var out=[];
  paths.forEach(function(p){
    var cmds=commands(p.d,p.transform);
    var inside=cmds.every(function(c){return c.points.every(function(pt){return pt.x>=0&&pt.x<=w&&pt.y>=0&&pt.y<=h})});
    var pieces=(p.dash&&p.dash.length)||!inside?cut(flatten(cmds),p.dash,p.dashOffset,w,h).map(function(run){
      return run.map(function(pt,i){return{type:i?'L':'M',points:[pt]}});
    }):[cmds];
    pieces.forEach(function(piece){
      if(piece.length>1)out.push({commands:piece,stroke:p.stroke,width:p.width,opacity:p.opacity,lineCap:p.lineCap,blend:p.blend||'source-over'});
    });
  });
  return out;
}
function ends(p){var c=p.commands;return[c[0].points[0],c[c.length-1].points.slice(-1)[0]]}
function travel(paths,origin){
  var total=0,at=origin;
  paths.forEach(function(p){var e=ends(p);total+=distance(at,e[0]);at=e[1]});
  return total;
}
function optimize(paths,origin){
  // Two-state dynamic program: only direction changes, never drawing order.
  // Finds minimum pen-up travel for this fixed sequence in linear time.
  if(!paths.length)return [];
  var costs=[],parents=[];
  paths.forEach(function(p,i){
    var e=ends(p),row=[],prev=[];
    for(var dir=0;dir<2;dir++){
      var start=e[dir];
      if(!i){row[dir]=distance(origin,start);prev[dir]=0}
      else{
        var last=ends(paths[i-1]);
        var a=costs[i-1][0]+distance(last[1],start);
        var b=costs[i-1][1]+distance(last[0],start);
        prev[dir]=a<=b?0:1;row[dir]=Math.min(a,b);
      }
    }
    costs.push(row);parents.push(prev);
  });
  var dir=costs[costs.length-1][0]<=costs[costs.length-1][1]?0:1,result=new Array(paths.length);
  for(var i=paths.length-1;i>=0;i--){
    result[i]=Object.assign({},paths[i],{commands:dir?reversed(paths[i].commands):paths[i].commands});
    dir=parents[i][dir];
  }
  return result;
}
function pathTag(p){
  return '<path d="'+esc(serialize(p.commands))+'" fill="none" stroke="'+esc(p.stroke)+'" stroke-width="'+p.width+'" stroke-opacity="'+p.opacity+'" stroke-linecap="'+esc(p.lineCap)+'" stroke-linejoin="round"'+(p.blend==='multiply'?' style="mix-blend-mode:multiply"':'')+'/>';
}
function collect(settings){
  var old=A.svgRecorder,oldMeta=A.lastRenderMeta,oldW=A.W,oldH=A.H;
  var canvas=document.createElement('canvas'),rec={paths:[],paperMarks:[],background:settings.paper,precise:true};
  try{A.svgRecorder=rec;A.render(canvas,settings,1,false);return{rec:rec,w:canvas.width,h:canvas.height}}
  finally{A.svgRecorder=old;A.lastRenderMeta=oldMeta;A.W=oldW;A.H=oldH}
}
A.createPlotterSVG=function(settings,options){
  options=options||{};
  var paper=options.paper||'A4',sizes={A4:[297,210],A3:[420,297]};
  if(!sizes[paper])throw Error('Choose A4 or A3 paper');
  var portrait=settings.orientation==='portrait',page=sizes[paper].slice();
  if(portrait)page.reverse();
  var margin=options.margin==null?10:Number(options.margin);
  if(!Number.isFinite(margin)||margin<0||margin>=Math.min(page[0],page[1])/2)throw Error('Margin must leave space for the artwork');
  var captured=collect(settings),w=captured.w,h=captured.h,rec=captured.rec;
  var scale=Math.min((page[0]-2*margin)/w,(page[1]-2*margin)/h);
  var x=(page[0]-w*scale)/2,y=(page[1]-h*scale)/2;
  var origin=point(-x/scale,-y/scale),paths=prepare(rec.paths,w,h),before=travel(paths,origin);
  if(options.optimize!==false)paths=optimize(paths,origin);
  var after=travel(paths,origin),layers=[],layer=null;
  paths.forEach(function(p){
    if(!layer||layer.colour!==p.stroke){layer={colour:p.stroke,paths:[]};layers.push(layer)}
    layer.paths.push(p);
  });
  var metadata={generator:'ALGO/ART',rendererVersion:A.rendererVersion,seed:settings.seed,settings:settings,
    paper:paper,pageMm:page,marginMm:margin,paperColour:settings.paper,pathOrder:'preserved',
    penTravelBeforeMm:before*scale,penTravelAfterMm:after*scale,paths:paths.length,colourRuns:layers.length};
  var content=layers.map(function(l,i){
    var pen=Array.from(new Set(paths.map(function(p){return p.stroke}))).indexOf(l.colour)+1;
    var name=String(i+1).padStart(3,'0')+' · Pen '+pen+' · '+l.colour;
    return '<g id="pen-run-'+(i+1)+'" inkscape:groupmode="layer" inkscape:label="'+esc(name)+'" data-pen-colour="'+esc(l.colour)+'" transform="translate('+x+' '+y+') scale('+scale+')" clip-path="url(#art-bounds)">'+l.paths.map(pathTag).join('')+'</g>';
  }).join('');
  var head='<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="'+NS+'" width="'+page[0]+'mm" height="'+page[1]+'mm" viewBox="0 0 '+page[0]+' '+page[1]+'" style="isolation:isolate">';
  var clip='<defs><clipPath id="art-bounds" clipPathUnits="userSpaceOnUse"><rect width="'+w+'" height="'+h+'"/></clipPath></defs>';
  function svg(preview){
    var background=preview?'<rect width="'+page[0]+'" height="'+page[1]+'" fill="'+esc(settings.paper)+'"/>':'';
    var grain=preview?rec.paperMarks.map(function(p){return'<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" fill="'+esc(p.colour)+'" opacity=".035"/>'}).join(''):'';
    return head+'<metadata>'+esc(JSON.stringify(metadata))+'</metadata>'+clip+background+
      (preview?'<g transform="translate('+x+' '+y+') scale('+scale+')" clip-path="url(#art-bounds)">'+grain+'</g>':'')+
      content+'</svg>';
  }
  return{svg:svg(false),preview:svg(true),metadata:metadata};
};
A.downloadPlotterSVG=function(result,settings){
  var blob=new Blob([result.svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.download='algoart-'+settings.seed+'-'+settings.mode+'-plotter.svg';link.href=url;link.click();
  setTimeout(function(){URL.revokeObjectURL(url)},1000);
};
// Exposed for deterministic geometry/route regression tests.
A.plotterGeometry={commands:commands,flatten:flatten,cut:cut,reversed:reversed,optimize:optimize,travel:travel,prepare:prepare};
})(window.AlgoArt);
