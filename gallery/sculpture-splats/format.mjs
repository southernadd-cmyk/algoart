// Portable binary sample layout. This is source-surface Gaussian data, not trained 3DGS.
export const SPLAT_FORMAT='pp-sculpture-splats';
export const SPLAT_FORMAT_VERSION=1;
export const SPLAT_ALGORITHM='v2-surface-uv-diffuse-v1';
export const SPLAT_STRIDE=11;
export const SPLAT_BUDGETS=Object.freeze({mobile:12000,desktop:30000});
export const SPLAT_GEOMETRY_REVISION='v4.2.1-v2-pigment-island-fix';
export function validEdition(date){
 if(date==='reception')return true;
 if(typeof date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(date))return false;
 const d=new Date(date+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===date;
}
export function validatePointRecords(points,meshCounts,materialCounts,expected){
 if(!Array.isArray(meshCounts)||!meshCounts.length||!Array.isArray(materialCounts)||materialCounts.length!==meshCounts.length||
    !Number.isSafeInteger(expected)||expected<1||points.length!==expected*SPLAT_STRIDE)throw Error('Invalid splat point count');
 const counts=new Uint32Array(meshCounts.length);
 for(let i=0;i<points.length;i+=SPLAT_STRIDE){
  for(let j=0;j<SPLAT_STRIDE;j++)if(!Number.isFinite(points[i+j]))throw Error('Non-finite splat point');
  const nx=points[i+3],ny=points[i+4],nz=points[i+5],r=points[i+8],mi=points[i+9],material=points[i+10];
  if(Math.abs(nx*nx+ny*ny+nz*nz-1)>1e-4||r<=0||!Number.isInteger(mi)||mi<0||mi>=meshCounts.length||
     !Number.isInteger(material)||material<0||material>=materialCounts[mi])throw Error('Invalid splat normal, radius or material');
  counts[mi]++;
 }
 if(counts.some(n=>n<4))throw Error('Splat asset omits a pigment region');
 return counts;
}
export function encodePointBytes(points){
 const bytes=new Uint8Array(points.length*4),view=new DataView(bytes.buffer);
 for(let i=0;i<points.length;i++)view.setFloat32(i*4,points[i],true);
 return bytes;
}
export function decodePointBytes(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength%44)throw Error('Malformed splat byte length');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const points=new Float32Array(bytes.byteLength/4);
 for(let i=0;i<points.length;i++)points[i]=view.getFloat32(i*4,true);
 return points;
}
