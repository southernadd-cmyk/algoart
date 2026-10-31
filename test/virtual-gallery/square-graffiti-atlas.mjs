// Bake the complete paint history of each masonry face into a single quad.
// This gives every tier the same physical surface and a fixed compositing order.
import {drawTag} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
export const SQUARE_ATLAS_PREFIX='square-wall-surface-v1|';
export function planSquareWallAtlases(marks,{lowPower=false}={}){
 const faces=new Map();
 for(const mark of marks){if(!faces.has(mark.face.id))faces.set(mark.face.id,[]);faces.get(mark.face.id).push(mark);}
 const size=lowPower?1536:2048,padding=8,ppm=lowPower?192:256,pages=[];
 let page=null,x=padding,y=padding,rowHeight=0;
 const nextPage=()=>{page={page:pages.length,size,height:0,entries:[]};pages.push(page);x=padding;y=padding;rowHeight=0;};
 for(const layers of faces.values()){
  const first=layers[0],face=first.face,bounds={x:0,y:0,width:face.length,height:face.height};
  const resolution=Math.min(ppm,(size-padding*2)/bounds.width,(size-padding*2)/bounds.height);
  const width=Math.ceil(bounds.width*resolution),height=Math.ceil(bounds.height*resolution);
  if(!page)nextPage();
  if(x+width+padding>size){x=padding;y+=rowHeight+padding*2;rowHeight=0;}
  if(y+height+padding>size)nextPage();
  const mark={...first,id:face.id,position:{x:face.centre.x,y:face.height/2,z:face.centre.z},
   width:bounds.width,height:bounds.height,rotation:0,bounds,markCount:layers.length,
   tag:{renderer:'square-wall-v1',form:'surface',bounds,layers}};
  page.entries.push({mark,x,y,width,height});page.height=Math.max(page.height,y+height+padding);
  x+=width+padding*2;rowHeight=Math.max(rowHeight,height);
 }
 return pages;
}
export function paintSquareWall(ctx,tag,{width,height,paintUnderstroke}){
 const ppm=Math.max(width/tag.bounds.width,height/tag.bounds.height);
 for(const mark of tag.layers){
  // Isolate each writer's white undercoat before laying it over older paint.
  // Applying the dilation to the wall canvas would also smear earlier tags.
  const pad=16,w=Math.ceil(mark.width*ppm),h=Math.ceil(mark.height*ppm);
  const tile=document.createElement('canvas');tile.width=w+pad*2;tile.height=h+pad*2;
  const g=tile.getContext('2d',{alpha:true}),b=mark.bounds;
  g.save();g.translate(pad,pad);g.scale(w/b.width,h/b.height);g.translate(-b.x,-b.y);
  drawTag(g,mark.tag,{finish:'spray'});g.restore();
  paintUnderstroke(g,pad,pad,w,h);
  const n=mark.normal,right={x:n.z,z:-n.x},face=mark.face;
  const u=(mark.position.x-face.centre.x)*right.x+(mark.position.z-face.centre.z)*right.z;
  ctx.save();ctx.translate(face.length/2+u,face.height-mark.position.y);ctx.rotate(-mark.rotation);
  ctx.drawImage(tile,-mark.width/2-pad/ppm,-mark.height/2-pad/ppm,mark.width+pad*2/ppm,mark.height+pad*2/ppm);
  ctx.restore();
 }
}
