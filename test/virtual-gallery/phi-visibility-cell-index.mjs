// TEST-ONLY experimental potential-visibility-set (PVS) compiler.
// A complete line-of-sight cone must cross ONE SAME opaque solid wall for
// every viewer-cell corner and every target-piece corner to mark it invisible.
// Keeping the test deliberately conservative avoids replacing real pixels.
// It consumes exact deterministic phi geometry; no Three.js scene mutation.
import {phiSolidWallCoversPiece} from './phi-room-visibility-culler.mjs';

function finitePiece(p){
 return p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.w>0&&p.h>0;
}
function occludedForCell(corners,parts,walls){
 return parts.length>0&&parts.every(part=>
  walls.some(w=>corners.every(view=>phiSolidWallCoversPiece(view,part,w,{margin:.12}))));
}
export function compilePhiVisibilityCells({pieces=[],rooms=[],walls=[],cellSize=2.5,maxCells=650,now=()=>performance.now()}={}){
 const began=now();
 if(!(cellSize>.2&&Number.isFinite(cellSize))||!Array.isArray(rooms)||!Array.isArray(pieces)||!Array.isArray(walls))
  throw new TypeError('Invalid visibility-cell input');
 const cells=[],perRoom=new Map();
 const partsByRoom=rooms.map((room,i)=>room.pieces?.filter(finitePiece)||[]);
 let candidateChecks=0,safeHidden=0;
 // Compile each existing convex phi floor-piece separately; no cell spans a
 // room seam or a glass walkway. If the room map is ambiguous, the runtime
 // falls back to the original exact-position culler.
 for(let room=0;room<rooms.length;room++){
  const records=[];
  for(const p of partsByRoom[room]){
   const nx=Math.ceil(p.w/cellSize),nz=Math.ceil(p.h/cellSize);
   if(cells.length+nx*nz>maxCells){
    return {enabled:false,reason:'cell-limit',cells:[],cellCount:0,compileMs:now()-began,
     hiddenRooms:()=>null,stats:()=>({enabled:false,reason:'cell-limit',candidateChecks})};
   }
   for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
    const x0=p.x+p.w*ix/nx,x1=p.x+p.w*(ix+1)/nx;
    const z0=p.z+p.h*iz/nz,z1=p.z+p.h*(iz+1)/nz;
    const corners=[{x:x0,z:z0},{x:x1,z:z0},{x:x0,z:z1},{x:x1,z:z1}];
    const hidden=[];
    for(let target=0;target<rooms.length;target++){
     if(target===room)continue;
     candidateChecks++;
     if(occludedForCell(corners,partsByRoom[target],walls)){hidden.push(target);safeHidden++;}
    }
    const cell={room,x0,x1,z0,z1,hidden};
    cells.push(cell);records.push(cell);
   }
  }
  perRoom.set(room,records);
 }
 let hits=0,misses=0;
 const hiddenRooms=(point,viewerRoom)=>{
  if(!Number.isInteger(viewerRoom)||viewerRoom<0){misses++;return null;}
  // Exclude exact shared-cell borders; the original culler handles uncertainty.
  const margin=1e-5;
  const cell=(perRoom.get(viewerRoom)||[]).find(c=>
   point.x>c.x0+margin&&point.x<c.x1-margin&&
   point.z>c.z0+margin&&point.z<c.z1-margin);
  if(!cell){misses++;return null;}
  hits++;return cell.hidden;
 };
 const compiled={enabled:true,reason:null,cells,cellCount:cells.length,
  compileMs:now()-began,hiddenRooms,
  stats:()=>({enabled:true,cellCount:cells.length,compileMs:+compiled.compileMs.toFixed(2),
   candidateChecks,safeHidden,hits,misses,rooms:rooms.length})};
 return compiled;
}
