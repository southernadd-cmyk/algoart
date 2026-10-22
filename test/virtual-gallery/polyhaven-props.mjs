// Optional CC0 Poly Haven architectural props. No dependency at first paint.
// Model URLs are discovered from Poly Haven's file manifest, never guessed.
// https://polyhaven.com/a/painted_wooden_bench
// https://polyhaven.com/a/modern_ceiling_lamp_01
const assets=new Map();
async function resolveModelURL(id){
 const response=await fetch('https://api.polyhaven.com/files/'+encodeURIComponent(id));
 if(!response.ok)throw Error('Poly Haven file manifest '+response.status);
 const manifest=await response.json();
 const matches=[];
 const fileURLs=new Map();
 function visit(node,path=[]){
  if(!node||typeof node!=='object')return;
  if(typeof node.url==='string'){
   const filename=new URL(node.url).pathname.split('/').pop();
   if(filename)fileURLs.set(filename.toLowerCase(),node.url);
  }
  if(typeof node.url==='string'&&/\.gltf(?:\?|$)/i.test(node.url)){
   const label=path.join('/').toLowerCase();
   matches.push({url:node.url,score:(label.includes('1k')?20:label.includes('2k')?10:0)+(label.includes('gltf')?5:0)});
  }
  for(const [key,val] of Object.entries(node))if(val&&typeof val==='object')visit(val,path.concat(key));
 }
 visit(manifest);
 matches.sort((a,b)=>b.score-a.score);
 if(!matches.length)throw Error('No glTF download listed for '+id);
 return {url:matches[0].url,fileURLs};
}
export async function loadPolyHavenProp(id){
 if(!assets.has(id)){
  assets.set(id,(async()=>{
   const [{GLTFLoader},{url,fileURLs},THREE]=await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),resolveModelURL(id),import('three')]);
   // Poly Haven glTF texture references are relative, while the actual
   // dependency URLs are supplied separately in the official file manifest.
   const manager=new THREE.LoadingManager();
   manager.setURLModifier(requestURL=>{
    const name=new URL(requestURL,url).pathname.split('/').pop()?.toLowerCase();
    return fileURLs.get(name)||requestURL;
   });
   return await new Promise((resolve,reject)=>{
    new GLTFLoader(manager).load(url,gltf=>resolve(gltf.scene),undefined,reject);
   });
  })().catch(error=>{console.warn('Optional Poly Haven model unavailable:',id,error);return null;}));
 }
 return assets.get(id);
}
export async function replaceFixtureWithProp(THREE,{id,parent,placeholder,position,rotation=0,width,height,depth,onPlaced}){
 const source=await loadPolyHavenProp(id);
 if(!source||!parent.parent)return null;
 const model=source.clone(true);
 const bounds=new THREE.Box3().setFromObject(model);
 const size=bounds.getSize(new THREE.Vector3());
 if(Math.min(size.x,size.y,size.z)<.001)return null;
 const scaling=Math.min(width/size.x,height/size.y,depth/size.z);
 model.scale.setScalar(scaling);
 // Align on bottom of prop before rotating to match local fixture axes.
 const scaledBounds=new THREE.Box3().setFromObject(model);
 const midpoint=scaledBounds.getCenter(new THREE.Vector3());
 model.position.set(-midpoint.x, -scaledBounds.min.y, -midpoint.z);
 const holder=new THREE.Group();
 holder.position.copy(position);
 holder.rotation.y=rotation;
 holder.add(model);
 parent.add(holder);
 // Do not dispose shared placeholder geometry or materials.
 if(placeholder)placeholder.visible=false;
 onPlaced?.(holder);
 return holder;
}
