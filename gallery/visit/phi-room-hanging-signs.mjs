// SHARED LIVE + TEST — hanging room signage after Sousinho's "Hospital hanging signage"
// (CC BY 4.0). Adapted from the uploaded GLB to lightweight untextured geometry:
// rectangular metal panel, two suspension cables, upper fixings and end caps.
// Original: https://sketchfab.com/3d-models/hospital-hanging-signage-74157aae9eb746d9a0cfe7f9c5c7f83f
// All positions are floor-local; the tower applies its golden-angle world transform.
const MATERIAL_NAMES={
  marker:'Marker',tissue:'Tissue & graphite',watercolour:'Watercolour',
  watercolor:'Watercolour',oil:'Oil',action:'Action painting'
};
const ENGINE_NAMES={
  field:'Orbital fields',trajectory:'Golden trajectories',trajectories:'Golden trajectories',
  rects:'Rectangular forms',rect:'Rectangular forms',burst:'Radiant systems',
  growth:'Growth systems',network:'Connected fields',automatic:'Automatic marks',
  recursive:'Recursive divisions',organic:'Organic forms',construct:'Constructed forms'
};
const pretty=value=>String(value||'').replace(/[-_]+/g,' ').trim().replace(/\b[a-z]/g,c=>c.toUpperCase());
const themeLabel=(dimension,value)=>{
  if(dimension==='material')return MATERIAL_NAMES[value]||pretty(value);
  if(dimension==='engine')return ENGINE_NAMES[value]||pretty(value)+' engine';
  if(dimension==='palette')return pretty(value)+' palette';
  return '';
};
export function roomSignTitle(room){
  const total=room?.studyIds?.length||0;
  if(!total)return '';
  let label='';
  const composition=room.composition;
  if(composition){
    // A name describes every displayed work, not the curator's majority.
    // Prefer a shared material, then a shared engine or palette.
    for(const dimension of ['material','engine','palette']){
      const entries=composition[dimension]||[];
      if(entries.length===1&&entries[0].value&&entries[0].count===total){
        label=themeLabel(dimension,entries[0].value);break;
      }
    }
    if(!label){
      const materials=composition.material||[];
      const complete=materials.every(m=>m.value)&&materials.reduce((n,m)=>n+m.count,0)===total;
      label=complete&&materials.length===2
        ?materials.map(m=>themeLabel('material',m.value)).join(' / ')
        :complete&&materials.length>2?'Mixed materials':'Mixed studies';
    }
  }else{
    // Older plans must not turn a partial theme into an exclusive room title.
    const theme=room.theme;
    if(theme?.value&&Number(theme.count)===total)label=themeLabel(theme.dimension,theme.value);
  }
  return label?'Room '+(room.room+1)+' · '+label:'';
}
const inside=(room,x,z,margin=.05)=>room?.pieces?.some(p=>
  x>=p.x+margin&&x<=p.x+p.w-margin&&
  z>=p.z+margin&&z<=p.z+p.h-margin);
function insideDoor(room,door,margin=.55){
  const a=door.axis==='x'
    ?{x:door.at+margin,z:door.centre}
    :{x:door.centre,z:door.at+margin};
  const b=door.axis==='x'
    ?{x:door.at-margin,z:door.centre}
    :{x:door.centre,z:door.at-margin};
  if(inside(room,a.x,a.z))return a;
  if(inside(room,b.x,b.z))return b;
  return null;
}
export function planHangingRoomSigns(phi){
  const rooms=phi.floor.mergedRooms;
  const doorways=phi.circulation.doors;
  const liftDoor=phi.circulation.lift?.portal;
  // Start the one-sign-per-room layout at the lift landing. Each other room
  // receives the doorway through which a visitor would first reach it.
  const root=liftDoor?rooms.findIndex(r=>insideDoor(r,liftDoor)):0;
  const start=root<0?0:root;
  const queue=[start],seen=new Set(queue),entry=new Map();
  if(liftDoor)entry.set(start,liftDoor);
  while(queue.length){
    const current=queue.shift();
    for(const d of doorways){
      const adjacent=d.a===current?d.b:d.b===current?d.a:-1;
      if(adjacent<0||seen.has(adjacent))continue;
      seen.add(adjacent);
      entry.set(adjacent,d);queue.push(adjacent);
    }
  }
  const result=[];
  for(const curated of phi.exhibition.curation?.rooms||[]){
    const label=roomSignTitle(curated);
    const room=rooms[curated.room],door=entry.get(curated.room);
    if(!label||!room||!door||door.width<1.85)continue;
    const spot=insideDoor(room,door);
    if(!spot)continue;
    // No independent obstacles: all hardware clears walking-height completely.
    result.push({room:curated.room,label,x:spot.x,z:spot.z,
      yaw:door.axis==='x'?Math.PI/2:0,
      dimension:curated.theme?.dimension||null,matchCount:curated.theme?.count||0,
      total:curated.studyIds.length});
  }
  return result;
}
function markerTexture(THREE,label){
  const canvas=document.createElement('canvas');
  canvas.width=1024;canvas.height=160;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,1024,160);
  // Upper and lowercase, retaining the human marker character of the site.
  let size=102;
  do{ctx.font=size+'px "AlgoArt Marker", Georgia, serif';size-=3;}
  while(ctx.measureText(label).width>960&&size>40);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#f0eadc';ctx.fillText(label,512,81);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
export function addHangingRoomSigns(THREE,scene,phi,elevation,ceilingHeight){
  const descriptions=planHangingRoomSigns(phi);
  const metal=new THREE.MeshStandardMaterial({color:0x66716a,metalness:.65,roughness:.43,side:THREE.DoubleSide});
  const frame=new THREE.MeshStandardMaterial({color:0x323f37,metalness:.47,roughness:.54});
  const hangers=new THREE.MeshStandardMaterial({color:0xb6ad8b,metalness:.65,roughness:.36});
  const mount=(parent,geometry,material,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const cable=(parent,x,from,to,radius=.007)=>{
    if(to<=from)return;
    mount(parent,new THREE.CylinderGeometry(radius,radius,to-from,8),hangers,
      x,(to+from)/2,0);
  };
  for(const spec of descriptions){
    const root=new THREE.Group();
    root.name='test-room-hanging-sign-'+(spec.room+1);
    root.userData={...spec,attribution:'Sousinho · CC BY 4.0'};
    root.position.set(spec.x,elevation+2.24,spec.z);
    root.rotation.y=spec.yaw;
    // Supplied Sketchfab sign uses a long, thin metal fascia with two end
    // cables. Match its 4.25:1.19 silhouette after converting to room scale.
    mount(root,new THREE.BoxGeometry(1.60,.187,.027),frame,0,.095,0);
    for(const y of [.018,.172]){
      mount(root,new THREE.BoxGeometry(1.61,.010,.035),metal,0,y,0);
    }
    for(const x of [-.615,.615]){
      // The original model's end wires and ferrules are held in pairs.
      cable(root,x,.188,.47,.009);
      mount(root,new THREE.SphereGeometry(.019,8,6),metal,x,.192,0);
      mount(root,new THREE.CylinderGeometry(.022,.022,.028,10),metal,x,.462,0);
      cable(root,x,.47,Math.max(.49,ceilingHeight-2.24-.09),.006);
      mount(root,new THREE.CylinderGeometry(.039,.039,.021,10),metal,x,
        Math.max(.49,ceilingHeight-2.24-.075),0);
    }
    const tex=markerTexture(THREE,spec.label);
    const titleMaterial=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.FrontSide,depthWrite:false});
    for(const side of [-1,1]){
      const face=mount(root,new THREE.PlaneGeometry(1.5,.15),titleMaterial,0,.095,side*.017);
      if(side<0)face.rotation.y=Math.PI;
    }
    scene.add(root);
  }
  return descriptions;
}
