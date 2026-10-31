import {nameExhibitionRooms} from './phi-room-names.mjs';
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
const roomAt=(rooms,door,side,step=.55)=>{
 const x=door.axis==='x'?door.at+side*step:door.centre;
 const z=door.axis==='z'?door.at+side*step:door.centre;
 return rooms.findIndex(room=>inside(room,x,z));
};
const roomCaption=(room,names)=>{
 if(room<0)return null;
 const name=names.get(room);
 return name?{
  room,label:'Room '+(room+1)+' · '+name.title,
  title:name.title,
  subtitle:name.dimension?name.values.map(v=>themeLabel(name.dimension,v)).join(' / '):'Selected studies'
 }:{
  room,label:'Room '+(room+1)+' · Gallery',title:'Gallery',
  subtitle:'Exhibition space'
 };
};
const passageCaption=kind=>kind==='lift'
 ?{room:null,label:'Archive lift',title:'Archive lift',subtitle:'Other exhibition floors'}
 :{room:null,label:'Glass walkway',title:'Glass walkway',subtitle:'Across the gallery'};
/** One physical sign per doorway. The +axis-facing face names the -axis room
 * and vice versa: a visitor always reads the room they are about to enter. */
export function planHangingRoomSigns(phi){
 const rooms=phi.floor.mergedRooms;
 const names=nameExhibitionRooms(phi.exhibition.curation?.rooms||[]);
 const result=[],used=new Set();
 const passages=[
  ...(phi.circulation.doors||[]).map(door=>({door,kind:'room'})),
  ...(phi.circulation.bridgePortals||[]).map(door=>({door,
   kind:door===phi.circulation.lift?.portal||(
    door.axis===phi.circulation.lift?.portal?.axis&&
    Math.abs(door.at-phi.circulation.lift.portal.at)<.001&&
    Math.abs(door.centre-phi.circulation.lift.portal.centre)<.001
   )?'lift':'bridge'}))
 ];
 const lift=phi.circulation.lift?.portal;
 if(lift&&!passages.some(p=>p.kind==='lift'))passages.push({door:lift,kind:'lift'});
 for(const {door,kind} of passages){
  if(!door||!['x','z'].includes(door.axis)||door.width<1.85)continue;
  const key=[door.axis,door.at.toFixed(3),door.centre.toFixed(3)].join('|');
  if(used.has(key))continue;
  used.add(key);
  const plusRoom=roomAt(rooms,door,1),minusRoom=roomAt(rooms,door,-1);
  if(plusRoom===minusRoom)continue;
  // The face seen from the positive side points into the negative side.
  const positive=roomCaption(minusRoom,names)||passageCaption(kind);
  const negative=roomCaption(plusRoom,names)||passageCaption(kind);
  if(!positive||!negative)continue;
  result.push({
   id:'passage-'+result.length,kind,
   x:door.axis==='x'?door.at:door.centre,
   z:door.axis==='z'?door.at:door.centre,
   yaw:door.axis==='x'?Math.PI/2:0,
   axis:door.axis,at:door.at,centre:door.centre,
   plusRoom,minusRoom,
   faces:{positive,negative}
  });
 }
 return result;
}
export function markerTexture(THREE,spec){
  const canvas=document.createElement('canvas');
  canvas.width=1536;canvas.height=320;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,1536,320);
  ctx.textAlign='center';ctx.textBaseline='middle';
  const line=(text,y,size,colour)=>{
    do{ctx.font=size+'px "AlgoArt Marker", Georgia, serif';size-=2;}
    while(ctx.measureText(text).width>1440&&size>24);
    ctx.fillStyle=colour;ctx.fillText(text,768,y);
  };
  line(spec.label,109,104,'#f0eadc');
  line(spec.subtitle,234,62,'#d3cbb9');
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
    root.name='room-doorway-directional-sign-'+spec.id;
    root.userData={...spec,attribution:'Sousinho · CC BY 4.0'};
    root.position.set(spec.x,elevation+2.24,spec.z);
    root.rotation.y=spec.yaw;
    // Taller fascia gives the title and factual subtitle distinct lines.
    mount(root,new THREE.BoxGeometry(1.60,.35,.027),frame,0,.175,0);
    for(const y of [.008,.342]){
      mount(root,new THREE.BoxGeometry(1.61,.010,.035),metal,0,y,0);
    }
    for(const x of [-.615,.615]){
      // The original model's end wires and ferrules are held in pairs.
      cable(root,x,.35,.55,.009);
      mount(root,new THREE.SphereGeometry(.019,8,6),metal,x,.354,0);
      mount(root,new THREE.CylinderGeometry(.022,.022,.028,10),metal,x,.542,0);
      cable(root,x,.55,Math.max(.57,ceilingHeight-2.24-.09),.006);
      mount(root,new THREE.CylinderGeometry(.039,.039,.021,10),metal,x,
        Math.max(.57,ceilingHeight-2.24-.075),0);
    }
    // Independent canvases: from either side the visible text describes the
    // room across the threshold, never the room the visitor is leaving.
    for(const side of [-1,1]){
      const descriptor=side>0?spec.faces.positive:spec.faces.negative;
      const tex=markerTexture(THREE,descriptor);
      const titleMaterial=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.FrontSide,depthWrite:false});
      const face=mount(root,new THREE.PlaneGeometry(1.5,.3125),titleMaterial,0,.175,side*.017);
      if(side<0)face.rotation.y=Math.PI;
      face.userData={targetRoom:descriptor.room,label:descriptor.label};
    }
    scene.add(root);
  }
  return descriptions;
}
