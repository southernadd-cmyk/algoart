// Test-only reception back-room installation. No external assets or video decoder.
export function addPhiReceptionLivingMonitor(THREE, scene, {room, world, elevation, camera}) {
 if (!room || !world?.toWorld) return null;
 const canvas=document.createElement('canvas');
 canvas.width=512;canvas.height=320;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return null;
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 const screenMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
 const bezelMaterial=new THREE.MeshStandardMaterial({color:0x141414,metalness:.36,roughness:.55});
 const root=new THREE.Group();
 root.name='phi-reception-living-painting';
 const localZ=room.z-room.depth/2+.19;
 const local=world.toWorld(room.x,localZ);
 root.position.set(local.x,elevation+2.05,local.z);
 root.rotation.y=world.theta||0;
 const frame=new THREE.Mesh(new THREE.BoxGeometry(1.36,.88,.07),bezelMaterial);
 root.add(frame);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.26,.788),screenMaterial);
 screen.position.z=.041;root.add(screen);
 const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=96;
 const labelCtx=labelCanvas.getContext('2d');
 labelCtx.fillStyle='#e9e3d6';labelCtx.fillRect(0,0,512,96);
 labelCtx.fillStyle='#202923';labelCtx.font='bold 26px Georgia';
 labelCtx.fillText('LIVING PAINTING No. 1',19,40);
 labelCtx.font='18px Georgia';labelCtx.fillText('Golden Trajectories · PROPORTION PIECE',19,72);
 const labelTexture=new THREE.CanvasTexture(labelCanvas);
 labelTexture.colorSpace=THREE.SRGBColorSpace;
 const labelMaterial=new THREE.MeshBasicMaterial({map:labelTexture,side:THREE.DoubleSide});
 const label=new THREE.Mesh(new THREE.PlaneGeometry(1.36,.255),labelMaterial);
 label.position.set(0,-.61,.043);root.add(label);
 scene.add(root);
 let disposed=false,last=0,frameId=0,draws=0;
 const origin=performance.now();
 function render(time){
   if(disposed)return;
   frameId=requestAnimationFrame(render);
   if(time-last<100) return; // 10fps maximum, only while nearby
   if(camera.getWorldPosition(new THREE.Vector3()).distanceTo(root.position)>11)return;
   last=time;
   const t=(time-origin)*.00016;
   ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,512,320);
   ctx.lineCap='round';
   const phi=(1+Math.sqrt(5))/2;
   for(let i=0;i<36;i++){
     const angle=i*2*Math.PI/(phi*phi)+t*(.45+(i%4)*.07);
     const radius=12+Math.sqrt(i/36)*136;
     const x=256+Math.cos(angle)*radius*1.43;
     const y=160+Math.sin(angle)*radius*.91;
     ctx.beginPath();
     ctx.moveTo(x,y);
     const a=angle+t*.4;
     ctx.bezierCurveTo(x+Math.cos(a+1)*38,y+Math.sin(a+1)*38,
       x+Math.cos(a+1.7)*61,y+Math.sin(a+1.7)*47,
       x+Math.cos(a+2.4)*74,y+Math.sin(a+2.4)*65);
     ctx.strokeStyle=['#31545c','#ba7453','#a99b69','#323a3b'][i%4];
     ctx.globalAlpha=.55+.25*Math.sin(t+i);
     ctx.lineWidth=1.3+(i%5)*.43;ctx.stroke();
   }
   ctx.globalAlpha=1;
   texture.needsUpdate=true;draws++;
 }
 // A useful still is available even before the first animation frame.
 ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,512,320);
 frameId=requestAnimationFrame(render);
 return {root,get drawCount(){return draws;},dispose(){
   disposed=true;cancelAnimationFrame(frameId);scene.remove(root);
   root.traverse(object=>object.geometry?.dispose());
   texture.dispose();labelTexture.dispose();screenMaterial.dispose();
   bezelMaterial.dispose();labelMaterial.dispose();
 }};
}
