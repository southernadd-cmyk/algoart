import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('gallery/visit/gallery-v2.js','utf8');
const bundle=readFileSync('gallery/visit/gallery-bundle.js','utf8');
// Load the gallery's actual Three.js maths without constructing the app/GL.
const maths={console,URL,URLSearchParams,TextDecoder,TextEncoder,AbortController,
  performance,window:{addEventListener(){}},location:{search:'',href:'http://localhost/'}};
vm.createContext(maths);
vm.runInContext(bundle.slice(0,bundle.indexOf('var In='))+';globalThis.THREE=Wt;',maths);
const THREE=maths.THREE;
const implementations=[
  {name:'source',code:source.slice(source.indexOf('function updateMovement(dt)'),source.indexOf('function detectArt(')),
    fn:'updateMovement',names:{plan:'plan',welcome:'welcome',ui:'$',travelling:'liftTravelling',
      look:'lookPressed',pressed:'pressed',touch:'touchPressed',renderer:'renderer',camera:'camera',
      vector:'THREE',yaw:'yaw',pitch:'pitch',latched:'xrTurnLatched',rig:'rig',stand:'canStand',
      path:'onArrivalPath',clear:'clearOfSculptures',sculptures:'sculpturePlacements',
      footprint:'footprintAt',near:'nearLift',panel:'xrLiftPanel',wasNear:'liftWasNear',
      close:'closeXRLift',open:'openLift'}},
  {name:'shipped bundle',code:bundle.slice(bundle.indexOf('function cE('),bundle.indexOf('function lE(')),
    fn:'cE',names:{plan:'en',welcome:'Ui',ui:'Ue',travelling:'Ni',look:'_i',pressed:'_n',touch:'ta',
      renderer:'et',camera:'qt',vector:'C',yaw:'Xt',pitch:'Wn',latched:'gd',rig:'je',stand:'qp',
      path:'Zm',clear:'Yp',sculptures:'Ol',footprint:'Xp',near:'$T',panel:'Pn',wasNear:'zl',
      close:'Ed',open:'sg'}}
];
function controller(implementation,yaw=0,head=0){
  const xrCamera=new THREE.PerspectiveCamera();
  xrCamera.matrixAutoUpdate=false;
  xrCamera.matrix.makeRotationY(head);
  // Mirrors a rendered XR camera: world matrix includes the rig, but the
  // camera is parentless and its local matrix is the tracked headset pose.
  xrCamera.matrixWorld.makeRotationY(yaw+head);
  const rig=new THREE.Group();rig.rotation.y=yaw;
  const left={handedness:'left',gamepad:{axes:[0,0,0,0]}};
  const right={handedness:'right',gamepad:{axes:[0,0,0,0]}};
  const values={plan:{},welcome:{hidden:true},ui:()=>({hidden:true}),travelling:false,
    look:new Set(),pressed:new Set(),touch:new Set(),
    renderer:{xr:{isPresenting:true,getSession:()=>({inputSources:[left,right]}),getCamera:()=>xrCamera}},
    camera:new THREE.PerspectiveCamera(),vector:implementation.name==='source'?THREE:THREE.Vector3,
    yaw,pitch:0,latched:false,rig,stand:()=>true,path:()=>false,clear:()=>true,sculptures:[],
    footprint:()=>({y:0}),near:()=>false,panel:null,wasNear:false,close(){},open(){}};
  const context=Object.fromEntries(Object.entries(values).map(([key,value])=>[implementation.names[key],value]));
  vm.createContext(context);vm.runInContext(implementation.code,context);
  return {rig,left,right,context,
    step:()=>context[implementation.fn](.1),
    yaw:()=>context[implementation.names.yaw]};
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);
for(const implementation of implementations){
  test(implementation.name+': left stick follows the rendered view across rotated rooms and headset poses',()=>{
    for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
      for(const head of [0,Math.PI/2]){
        for(const [name,x,y] of [['forward',0,-1],['back',0,1],['left',-1,0],['right',1,0]]){
          const c=controller(implementation,yaw,head);
          c.left.gamepad.axes[2]=x;c.left.gamepad.axes[3]=y;c.step();
          const angle=yaw+head;
          close(c.rig.position.x,(Math.sin(angle)*y+Math.cos(angle)*x)*.32);
          close(c.rig.position.z,(Math.cos(angle)*y-Math.sin(angle)*x)*.32);
          close(Math.hypot(c.rig.position.x,c.rig.position.z),.32);
        }
      }
    }
  });
  test(implementation.name+': right stick snap-turns once, re-arms at neutral, and updates forward movement',()=>{
    const c=controller(implementation,Math.PI/2,Math.PI/2);
    c.right.gamepad.axes[2]=1;c.step();close(c.yaw(),Math.PI/3);
    c.step();close(c.yaw(),Math.PI/3);
    close(c.rig.position.length(),0);
    c.right.gamepad.axes[2]=0;c.step();
    c.right.gamepad.axes[2]=-1;c.step();close(c.yaw(),Math.PI/2);
    c.right.gamepad.axes[2]=0;c.step();c.left.gamepad.axes[3]=-1;c.step();
    close(c.rig.position.x,0);close(c.rig.position.z,.32);
  });
  test(implementation.name+': neutral/dead-zone inputs do not walk or turn',()=>{
    const c=controller(implementation,Math.PI/2);
    c.left.gamepad.axes=[0,0,.1,-.1];c.right.gamepad.axes=[0,0,.1,0];c.step();
    close(c.rig.position.length(),0);close(c.yaw(),Math.PI/2);
  });
}
