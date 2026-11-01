// TEST ONLY: conservative, room-level visibility for paintings and sculptures.
// All coordinates are in floor-local X/Z. Geometry, materials, artwork and
// lighting remain exactly as they are; no approximation is rendered instead.
// A room is hidden ONLY if a single solid wall covers the entire view cone to
// every convex rectangle (piece) making up that room. A door opening, corner,
// glass bridge, near-wall view or uncertain position always keeps it visible.

const EPS=1e-6;
function roomContainingPoint(pieces,point,margin=.03){
 for(const piece of pieces){
  if(point.x>=piece.x-margin && point.x<=piece.x+piece.w+margin &&
     point.z>=piece.z-margin && point.z<=piece.z+piece.h+margin)return piece.room;
 }
 return -1;
}
export function phiSolidWallCoversPiece(observer,piece,wall,{margin=.09}={}){
 if(!piece||!wall||!observer)return false;
 const axis=wall.axis;
 if(axis!=='x'&&axis!=='z')return false;
 const origin=axis==='x'?observer.x:observer.z;
 const coordinate=axis==='x'?'x':'z';
 const transverse=axis==='x'?'z':'x';
 const corners=[
  {x:piece.x,z:piece.z},{x:piece.x+piece.w,z:piece.z},
  {x:piece.x,z:piece.z+piece.h},{x:piece.x+piece.w,z:piece.z+piece.h}
 ];
 const d=wall.at-origin;
 if(Math.abs(d)<margin*2)return false;
 const along=observer[transverse];
 // The intersection position with a straight line and a wall plane is a
 // linear-fractional interpolation. Its range over this convex rectangle is
 // attained at corners, provided observer and entire rectangle lie on
 // opposite sides of the wall. Strict endpoint margins remove ambiguity.
 for(const corner of corners){
  const delta=corner[coordinate]-origin;
  if(Math.sign(delta)!==Math.sign(d)||Math.abs(delta)<=Math.abs(d)+margin)return false;
  const t=d/delta;
  if(t<=EPS||t>=1-EPS)return false;
  const u=along+t*(corner[transverse]-along);
  if(u<=wall.lo+margin||u>=wall.hi-margin)return false;
 }
 return true;
}
export function phiRoomHiddenBehindSolidWalls(observer,pieces,walls,{margin=.09}={}){
 if(!Array.isArray(pieces)||!pieces.length||!Array.isArray(walls)||!walls.length)return false;
 return pieces.every(piece=>walls.some(wall=>phiSolidWallCoversPiece(observer,piece,wall,{margin})));
}
export function createPhiRoomVisibilityCuller({pieces=[],rooms=[],walls=[],enabled=false,visibilityCells=null}={}){
 // This opt-in never changes renderable materials, transforms, or tree shape.
 const groups=new Map(),hidden=new Map();
 const roomPieces=(rooms||[]).map((room,index)=>
  (room?.pieces||[]).map(piece=>({...piece,room:index})));
 const roomCount=roomPieces.length;
 let checks=0,lastObserver=null,enabledNow=!!enabled,lastCulled=[],registered=0,restored=0;
 let compiledEnabled=!!visibilityCells?.enabled,compiledFastPaths=0,dynamicOcclusionChecks=0;
 const restore=()=>{
  for(const [object,wasVisible] of hidden){
   if(!object.userData?.galleryDisposed)object.visible=wasVisible;
  }
  restored+=hidden.size;
  hidden.clear();
  lastCulled=[];
 };
 const register=(room,object)=>{
  if(!Number.isInteger(room)||room<0||room>=roomCount||!object||!('visible' in object))return false;
  if(!groups.has(room))groups.set(room,new Set());
  if(!groups.get(room).has(object)){groups.get(room).add(object);registered++;}
  return true;
 };
 const update=(worldPoint,{safe=true}={})=>{
  checks++;
  if(!enabledNow||!safe||!worldPoint||!Number.isFinite(worldPoint.x)||!Number.isFinite(worldPoint.z)){
   restore();lastObserver=null;return snapshot();
  }
  // World-to-local is performed by the caller. Only a viewer actually inside
  // a room may cull: the shaft, windows, bridges and exterior all see every room.
  const viewerRoom=roomContainingPoint(pieces,worldPoint);
  if(viewerRoom<0){restore();lastObserver=null;return snapshot();}
  const culled=[];
  // Compiled PVS is an intentionally conservative subset of exact-location
  // wall occlusion. Uncovered cells retain the original dynamic calculation.
  const compiledHidden=compiledEnabled?visibilityCells.hiddenRooms(worldPoint,viewerRoom):null;
  for(const [room,objects] of groups){
   // A room containing the viewer must remain visible, even near a seam.
   let occluded=false;
   if(room!==viewerRoom){
    if(compiledHidden?.includes(room)){occluded=true;compiledFastPaths++;}
    else{
     // Never weaken the established culling decision to make a benchmark fast.
     // Rooms not provably hidden by the entire cell use the exact old test.
     dynamicOcclusionChecks++;
     occluded=phiRoomHiddenBehindSolidWalls(worldPoint,roomPieces[room],walls);
    }
   }
   if(occluded)culled.push(room);
   for(const object of objects){
    if(object.userData?.galleryDisposed||!object.parent){
     hidden.delete(object);objects.delete(object);continue;
    }
    if(occluded){
     if(!hidden.has(object))hidden.set(object,object.visible);
     object.visible=false;
    }else if(hidden.has(object)){
     object.visible=hidden.get(object);
     hidden.delete(object);restored++;
    }
   }
  }
  lastObserver={x:worldPoint.x,z:worldPoint.z,room:viewerRoom};
  lastCulled=culled;
  return snapshot();
 };
 const snapshot=()=>({enabled:enabledNow,rooms:roomCount,registered,hidden: hidden.size,
  culledRooms:[...lastCulled],visibleGroups:[...groups.keys()].filter(i=>!lastCulled.includes(i)),
  checks,restored,viewer:lastObserver,compiledEnabled,compiledFastPaths,dynamicOcclusionChecks,
  visibilityCells:visibilityCells?.stats?.()||null});
 const setEnabled=value=>{enabledNow=!!value;if(!enabledNow)restore();};
 const setCompiledEnabled=value=>{compiledEnabled=!!value&&!!visibilityCells?.enabled;restore();};
 const clear=()=>{restore();groups.clear();registered=0;lastObserver=null;checks=0;restored=0;};
 return {register,update,restore,clear,setEnabled,setCompiledEnabled,snapshot};
}
