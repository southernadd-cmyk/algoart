// Progressive, softly defocused exterior panorama. Only the background
// image is blurred: architecture, artworks and visitors remain full resolution.
// The original procedural sky stays visible until the replacement is ready.
const cached=new Map();

// Blur once during image loading (never per frame). The padded, horizontally
// wrapped source avoids the vertical seam of an equirectangular panorama.
function softenPanorama(THREE,image,lowPower){
  const sourceWidth=image.naturalWidth||image.width;
  const sourceHeight=image.naturalHeight||image.height;
  if(!sourceWidth||!sourceHeight)throw Error('Panorama image has no dimensions');
  const width=Math.min(sourceWidth,lowPower?1024:2048);
  const height=Math.max(1,Math.round(width*sourceHeight/sourceWidth));
  const blurRadius=lowPower?4:8; // subtle depth separation, not heavy defocus
  const pad=blurRadius*4;

  const scratch=document.createElement('canvas');
  scratch.width=width+pad*2;
  scratch.height=height+pad*2;
  const s=scratch.getContext('2d');
  if(!s)throw Error('Canvas 2D context unavailable for panorama');
  s.imageSmoothingQuality='high';
  // Main image and both wrapped ends share the same padded surface.
  s.drawImage(image,pad,pad,width,height);
  s.drawImage(image,pad-width,pad,width,height);
  s.drawImage(image,pad+width,pad,width,height);
  // Extend the polar edge pixels rather than blurring against transparent black.
  s.drawImage(scratch,0,pad,scratch.width,1,0,0,scratch.width,pad);
  s.drawImage(scratch,0,pad+height-1,scratch.width,1,0,pad+height,scratch.width,pad);

  const output=document.createElement('canvas');
  output.width=width;output.height=height;
  const c=output.getContext('2d');
  if(!c)throw Error('Canvas 2D context unavailable for panorama');
  c.filter='blur('+blurRadius+'px)';
  // Draw the FULL padded surface while offsetting it into the output, so
  // the filter sees neighbouring pixels across the image's left/right seam.
  c.drawImage(scratch,-pad,-pad);
  c.filter='none';

  const texture=new THREE.CanvasTexture(output);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.mapping=THREE.EquirectangularReflectionMapping;
  return texture;
}

export function loadSquarePanorama(THREE,scene,{sky,clouds,lowPower=false}={}){
  const full='./assets/day-environment-hdri-101-2k.jpg';
  const mobile='./assets/day-environment-hdri-101-1k.jpg';
  const use=texture=>{
    // A lift journey can rebuild the scene while this image is decoding.
    if(!sky?.parent||sky.parent!==scene)return;
    scene.background=texture;
    sky.visible=false;
    if(clouds)clouds.visible=false;
    // Preserve the original behaviour: the clear gallery stays free of fog.
    scene.fog=null;
  };
  const load=(url,allowFallback)=>{
    if(!cached.has(url)){
      cached.set(url,new Promise((resolve,reject)=>{
        new THREE.TextureLoader().load(url,raw=>{
          try {
            const softened=softenPanorama(THREE,raw.image,url===mobile);
            raw.dispose(); // Never retain or upload the unblurred source texture.
            resolve(softened);
          }catch(error){
            raw.dispose();
            reject(error);
          }
        },undefined,reject);
      }));
    }
    cached.get(url).then(use).catch(error=>{
      console.warn('Exterior panorama unavailable:',url,error);
      // On desktop, recover using the smaller locally hosted image.
      if(allowFallback&&url!==mobile)load(mobile,false);
    });
  };
  // Phones download and blur only 1K; desktops retain the higher-detail 2K.
  // Neither case adds an expensive post-processing pass to the 3D renderer.
  load(lowPower?mobile:full,!lowPower);
}
