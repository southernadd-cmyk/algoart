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
  var t=i/Math.max(1,count-1);
  var a=i*A.lerp(r.range(1.7,2.6),A.GOLD,s.goldenAngle/100);
  var rad=Math.pow(t,A.INV)*Math.min(A.W,A.H)*.43;
  return{x:A.W*.5+Math.cos(a)*rad,y:A.H*.5+Math.sin(a)*rad,a:a,rad:rad};
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
})(window.AlgoArt);