// Open-air-to-gallery threshold. Every geometry part is local to a root
// anchored at the actual seeded ground-floor entrance. No blocking requests.
export function createEntranceDoors(THREE,{doorway,outward,level,modelURL=null}){
  const root=new THREE.Group();
  root.name='museum-entrance-double-doors';
  root.position.set(doorway.x,level,doorway.z);
  root.rotation.y=Math.atan2(outward.x,outward.z);
  const bronze=new THREE.MeshStandardMaterial({
    color:'#47524d',roughness:.42,metalness:.47
  });
  const timber=new THREE.MeshStandardMaterial({
    color:'#d8cec0',roughness:.76,metalness:0
  });
  const glass=new THREE.MeshStandardMaterial({
    color:'#c4d8d8',roughness:.17,metalness:.02,
    transparent:true,opacity:.18,depthWrite:false,
    side:THREE.DoubleSide
  });
  // The 3.40 × 4.15m masonry opening is filled by a human-scale 1.54m
  // pair of doors plus fixed glazed sidelights and an upper transom.
  const openingW=3.4,openingH=4.15,doorW=1.54,doorH=2.171;
  const box=(parent,w,h,d,x,y,z,mat)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    parent.add(mesh);
    return mesh;
  };
  // The outer frame sits against the original wall's aperture, not in front
  // of it; no collider or blocking plane is added across the walking route.
  for(const x of [-openingW/2,openingW/2])
    box(root,.065,openingH,.11,x,openingH/2,0,bronze);
  box(root,openingW,.075,.11,0,openingH,0,bronze);
  box(root,openingW,.065,.11,0,doorH,0,bronze);
  for(const x of [-doorW/2,doorW/2])
    box(root,.067,doorH,.12,x,doorH/2,0,bronze);
  for(const side of [-1,1]){
    const sideW=(openingW-doorW)/2-.085;
    const x=side*(doorW/2+.044+sideW/2);
    box(root,sideW,doorH-.12,.019,x,doorH/2,0,glass);
    box(root,.039,doorH-.12,.085,x,doorH/2,0,bronze);
  }
  box(root,openingW-.12,openingH-doorH-.12,.019,
    0,(openingH+doorH)/2,0,glass);
  box(root,.052,openingH-doorH-.08,.09,
    0,(openingH+doorH)/2,0,bronze);
  const pivots=[new THREE.Group(),new THREE.Group()];
  const hinges=[-.709,.709];
  for(let i=0;i<2;i++){
    const p=pivots[i];p.position.set(hinges[i],0,0);
    p.name=i?'right-door-hinge':'left-door-hinge';
    root.add(p);
  }
  const procedural=new THREE.Group();root.add(procedural);
  // Pivot in the centre of the hinge, not at the centre of the door leaf.
  // +X goes inward on the left leaf; -X goes inward on the right.
  for(let i=0;i<2;i++){
    const sign=i===0?1:-1,leaf= new THREE.Group();
    const x=sign*.344,span=.679;
    for(const frameX of [0,sign*(span-.06)])
      box(leaf,.058,doorH-.09,.085,frameX,(doorH-.07)/2,0,timber);
    for(const y of [.065,1.045,doorH-.075])
      box(leaf,span,.065,.085,x,y,0,timber);
    box(leaf,span-.11,doorH-1.09,.025,x,1.56,0,glass);
    box(leaf,span-.11,.88,.075,x,.53,0,timber);
    for(const y of [1.38,1.75])
      box(leaf,span-.08,.035,.065,x,y,0,timber);
    box(leaf,.13,.045,.095,sign*(span-.12),1.04,.09,bronze);
    procedural.add(leaf);
    // The decorative placeholder can be swapped for the actual GLB without
    // affecting the floor plan, trigger radius, or hinge animation.
    pivots[i].add(leaf);
  }
  // Optional exact Innerscene GLB when it has been published in /models.
  // The asset was inspected: Sash/Latch/hinge-leaf nodes are separate parts.
  // A failed optional load does not affect traversal or the procedural doors.
  if(modelURL){
    import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>{
      new GLTFLoader().load(modelURL,gltf=>{
        if(!root.parent)return;
        const model=gltf.scene;
        model.updateMatrixWorld(true);
        const frameParts=[];
        const moving=[];
        model.traverse(node=>{
          if(!node.isMesh)return;
          if(/^(Sash \||Latch \||Door \| hinge leaf)/.test(node.name))
            moving.push(node);
          else frameParts.push(node);
        });
        if(moving.length<15)return; // Unexpected model: keep safe fallback.
        root.add(model);
        model.updateMatrixWorld(true);
        for(const part of moving){
          // Side from the actual GLB hinge x position, in real metres.
          const x=part.getWorldPosition(new THREE.Vector3()).x;
          const index=x<0?0:1;
          pivots[index].attach(part);
        }
        model.updateMatrixWorld(true);
        // Both hinges are at the origin of root's local door coordinates.
        // Model and root have matching unscaled metre units.
        for(const p of pivots){
          p.children.filter(child=>child.isGroup && !child.userData.fromGLB)
            .forEach(child=>child.visible=false);
        }
        for(const part of frameParts){if(!part.parent)model.add(part);}
        root.userData.detailedModelLoaded=true;
      },undefined,error=>console.warn('Optional French-door model unavailable',error));
    }).catch(error=>console.warn('GLB door loader unavailable',error));
  }
  let openness=0;
  const update=(dt,visitor)=>{
    if(!root.parent)return;
    const dx=visitor.x-doorway.x,dz=visitor.z-doorway.z;
    const along=dx*outward.x+dz*outward.z;
    const across=dx*outward.z-dz*outward.x;
    // Approach from either side. Doors remain open while within the threshold
    // so no player can get visually trapped by closing panels.
    const near=Math.abs(along)<3.3 && Math.abs(across)<2.45;
    const target=near?1:0;
    openness+=(target-openness)*Math.min(1,dt*3.2);
    if(Math.abs(openness-target)<.0005)openness=target;
    // Local +Z faces the forecourt. Negative-left / positive-right open out.
    pivots[0].rotation.y=-openness*1.64;
    pivots[1].rotation.y=openness*1.64;
  };
  return {root,update,pivots};
}
