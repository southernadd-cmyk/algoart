// Lightweight glazed bridge enclosure shared by the occupied gallery and
// archived exterior floors. No post-processing, external textures or loading.
export function createWalkwayGlassMaterials(THREE,{lowPower=false}={}){
  // Subtle frosted variation inspired by architectural glazing: generated
  // locally so the gallery does not depend on external image hosts/licences.
  const c=document.createElement('canvas');
  c.width=128;c.height=128;
  const ctx=c.getContext('2d');
  const pixels=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    // Very soft vertical rolling marks; no harsh stripes in the glass.
    const wave=2.3*Math.sin(x*.32)+1.4*Math.sin(x*.086+y*.04);
    const speck=(((x*37+y*73)^(x*y*13))&7)-3.5;
    const v=Math.max(225,Math.min(255,Math.round(246+wave+speck*.40)));
    const i=(y*128+x)*4;
    pixels.data[i]=v;pixels.data[i+1]=Math.min(255,v+2);
    pixels.data[i+2]=Math.min(255,v+3);pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(c);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.userData.galleryPersistent=true;
  const glass=new THREE.MeshStandardMaterial({
    color:'#dcebea',map:texture,transparent:true,
    opacity:lowPower?.22:.28,depthWrite:false,
    roughness:.28,metalness:.07,side:THREE.DoubleSide
  });
  const frame=new THREE.MeshStandardMaterial({
    color:'#53605d',roughness:.43,metalness:.62
  });
  // Geometry is disposed when a floor changes; these two materials are reused.
  glass.userData.galleryPersistent=true;
  frame.userData.galleryPersistent=true;
  return {glass,frame};
}

// The hall endpoints are the actual seeded floor-plan endpoints (and may have
// different elevations). Keep the two ends OPEN for unobstructed doors.
// Sides + transparent roof form one enclosure; metal bars are one instanced draw.
export function createGlassWalkway(THREE,start,end,width,materials,{lowPower=false}={}){
  const dx=end.x-start.x,dz=end.z-start.z,dy=end.y-start.y;
  const distance=Math.hypot(dx,dz);
  if(distance<.20)return new THREE.Group();
  const group=new THREE.Group();
  group.name='gallery-glass-walkway';
  group.userData.galleryGlassWalkway=true;
  group.position.set((start.x+end.x)/2,(start.y+end.y)/2,(start.z+end.z)/2);
  group.rotation.order='YXZ';
  group.rotation.set(-Math.atan2(dy,distance),Math.atan2(dx,dz),0);
  // Local +Z follows the bridge's actual inclined centreline.
  const length=Math.hypot(distance,dy);
  const halfWidth=width/2-.055, halfLength=length/2-.06;
  const bottom=.13,top=2.88;
  const positions=[],uv=[],indices=[];
  function panel(corners,uvScaleX=1,uvScaleY=1){
    const base=positions.length/3;
    corners.forEach(([x,y,z],i)=>{
      positions.push(x,y,z);
      uv.push((i===1||i===2)?uvScaleX:0,(i>=2)?uvScaleY:0);
    });
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  // The same two clear vertical wall panels and a glazed roof on each bridge.
  for(const side of [-1,1]){
    const x=side*halfWidth;
    panel([[x,bottom,-halfLength],[x,bottom,halfLength],
      [x,top,halfLength],[x,top,-halfLength]],length/3,1);
  }
  panel([[-halfWidth,top,-halfLength],[halfWidth,top,-halfLength],
    [halfWidth,top,halfLength],[-halfWidth,top,halfLength]],width/3,length/3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const glazing=new THREE.Mesh(geometry,materials.glass);
  glazing.name='glazed sides and roof';
  glazing.renderOrder=1;
  group.add(glazing);

  // Slim metal mullions, edge beams and roof ribs. Instancing keeps this one
  // draw call even for galleries with many footbridges.
  const members=[];
  const member=(x,y,z,w,h,d)=>members.push([x,y,z,w,h,d]);
  const bays=Math.max(1,Math.ceil(length/(lowPower?4.5:2.9)));
  for(const x of [-halfWidth,halfWidth]){
    member(x,bottom,0,.055,.075,length);
    member(x,top,0,.058,.072,length);
    for(let i=0;i<=bays;i++){
      const z=-halfLength+2*halfLength*i/bays;
      member(x,(bottom+top)/2,z,.065,top-bottom,.065);
    }
  }
  for(let i=0;i<=bays;i++){
    const z=-halfLength+2*halfLength*i/bays;
    member(0,top,z,width,.06,.055);
  }
  const frames=new THREE.InstancedMesh(
    new THREE.BoxGeometry(1,1,1),materials.frame,members.length
  );
  const transform=new THREE.Object3D();
  members.forEach(([x,y,z,w,h,d],i)=>{
    transform.position.set(x,y,z);
    transform.scale.set(w,h,d);
    transform.updateMatrix();
    frames.setMatrixAt(i,transform.matrix);
  });
  frames.instanceMatrix.needsUpdate=true;
  frames.computeBoundingSphere();
  frames.name='glazing mullions';
  group.add(frames);
  return group;
}
