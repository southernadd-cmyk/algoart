window.AlgoArt=window.AlgoArt||{};
(function(A){
'use strict';
A.PHI=(1+Math.sqrt(5))/2;
A.INV=1/A.PHI;
A.GOLD=Math.PI*(3-Math.sqrt(5));
A.TAU=Math.PI*2;
A.W=1400;
A.H=1000;

A.qphi=function(v,base,strength){
  var best=v,d=1e9;
  for(var k=-7;k<=7;k++){
    var q=base*Math.pow(A.PHI,k),nd=Math.abs(q-v);
    if(nd<d){d=nd;best=q}
  }
  return A.lerp(v,best,strength);
};

A.goldenPoint=function(i,count,s,r){
  return A.goldenCanvasPoint(i,count,s,0);
};

A.goldenCanvasPoint=function(i,count,s,phase){
  count=Math.max(1,count);
  phase=phase||0;
  var t=(i+.65)/count;
  var step=A.lerp(A.GOLD*.74,A.GOLD,s.goldenAngle/100);
  var a=phase+i*step;
  var radial=Math.pow(t,A.INV);
  var rx=A.W*.465*radial;
  var ry=A.H*.455*radial;
  return{
    x:A.W*.5+Math.cos(a)*rx,
    y:A.H*.5+Math.sin(a)*ry,
    a:a,
    rad:radial
  };
};

A.phiPoint=function(s,r){
  var ax=[A.INV*A.W,(1-A.INV)*A.W,A.W/2,A.W/(A.PHI*A.PHI),A.W-A.W/(A.PHI*A.PHI)];
  var ay=[A.INV*A.H,(1-A.INV)*A.H,A.H/2,A.H/(A.PHI*A.PHI),A.H-A.H/(A.PHI*A.PHI)];
  var p={x:r.pick(ax),y:r.pick(ay)};
  var rand={x:r.range(60,A.W-60),y:r.range(60,A.H-60)};
  var t=s.phiStrength/100,j=(1-t)*150;
  p.x+=r.range(-j,j);
  p.y+=r.range(-j,j);
  return{x:A.lerp(rand.x,p.x,t),y:A.lerp(rand.y,p.y,t)};
};

A.goldenCells=function(count,margin){
  count=Math.max(1,Math.floor(count));
  margin=margin==null?42:margin;
  var cells=[{x:margin,y:margin,w:A.W-margin*2,h:A.H-margin*2,depth:0}];
  var flip=0;

  while(cells.length<count){
    var best=0,bestScore=-1;
    for(var i=0;i<cells.length;i++){
      var c=cells[i];
      var score=c.w*c.h*(1+c.depth*.002);
      if(score>bestScore){bestScore=score;best=i}
    }

    var cell=cells.splice(best,1)[0];
    var firstLarge=(flip++%2===0);
    var ratio=firstLarge?A.INV:(1-A.INV);
    var a,b;

    if(cell.w>=cell.h){
      var cut=cell.w*ratio;
      a={x:cell.x,y:cell.y,w:cut,h:cell.h,depth:cell.depth+1};
      b={x:cell.x+cut,y:cell.y,w:cell.w-cut,h:cell.h,depth:cell.depth+1};
    }else{
      var cutY=cell.h*ratio;
      a={x:cell.x,y:cell.y,w:cell.w,h:cutY,depth:cell.depth+1};
      b={x:cell.x,y:cell.y+cutY,w:cell.w,h:cell.h-cutY,depth:cell.depth+1};
    }

    cells.push(a,b);
  }

  return cells;
};

A.distributedPhiPoints=function(count,s,r){
  var cells=A.goldenCells(count,42);

  for(var i=cells.length-1;i>0;i--){
    var j=r.int(0,i),tmp=cells[i];
    cells[i]=cells[j];
    cells[j]=tmp;
  }

  var strength=s.phiStrength/100;
  return cells.map(function(cell,i){
    var xf=(i%2===0)?A.INV:(1-A.INV);
    var yf=(i%3===0)?(1-A.INV):A.INV;
    var phiX=cell.x+cell.w*xf;
    var phiY=cell.y+cell.h*yf;
    var randomX=cell.x+cell.w*r.range(.22,.78);
    var randomY=cell.y+cell.h*r.range(.22,.78);

    return{
      x:A.lerp(randomX,phiX,strength),
      y:A.lerp(randomY,phiY,strength),
      territory:Math.sqrt(cell.w*cell.h),
      cell:cell
    };
  });
};

})(window.AlgoArt);