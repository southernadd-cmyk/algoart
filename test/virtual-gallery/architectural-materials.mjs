// PROPORTION PIECE virtual gallery — CC0 architectural material bank.
// Real photographic maps from Poly Haven; see MATERIALS.md in this directory.
// No dependency on the Poly Haven API at runtime. The static 1K files are
// fetched once on demand and reused by all rooms; failure is non-fatal.
// Three.js is passed in so this module can be unit-tested without WebGL.
export const MATERIAL_SOURCES=Object.freeze({
  walls:Object.freeze({
    asset:'plastered_wall_02',author:'Poly Haven',license:'CC0-1.0',
    diffuse:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plastered_wall_02/plastered_wall_02_diff_1k.jpg',
    normal:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plastered_wall_02/plastered_wall_02_nor_gl_1k.jpg',
    tileMeters:2.7
  }),
  floors:Object.freeze({
    asset:'concrete_floor',author:'Poly Haven',license:'CC0-1.0',
    diffuse:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor/concrete_floor_diff_1k.jpg',
    normal:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor/concrete_floor_nor_gl_1k.jpg',
    tileMeters:2.25
  }),
  timber:Object.freeze({
    asset:'wood_floor',author:'Poly Haven',license:'CC0-1.0',
    diffuse:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor/wood_floor_diff_1k.jpg',
    tileMeters:2.3
  }),
  brick:Object.freeze({
    asset:'Bricks055',author:'ambientCG',license:'CC0-1.0',
    source:'https://ambientcg.com/view?id=Bricks055',
    diffuse:'./textures/Bricks055_Color.jpg',
    normal:'./textures/Bricks055_NormalGL.jpg',
    roughness:'./textures/Bricks055_Roughness.jpg',
    tileMeters:1.05
  })
});
// Optional CC0 scans prepared from the uploaded OpenGameArt 50-texture pack.
// These local files are intentionally optional: existing Poly Haven maps remain
// as a reliable fallback until the optimised files are published.
export const LOCAL_TEXTURES=Object.freeze({
  walls:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plastered_wall_02/plastered_wall_02_diff_1k.jpg',
  floors:'./textures/open-game-art/028.jpg',
  stone:'./textures/open-game-art/048.jpg'
});
export const FINISHES=Object.freeze(['stone','timber','minimal']);
function tintScan(image,mode,limit=768){
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,limit/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  if(mode==='timber')return canvas;
  const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
  const d=frame.data;
  // Neutralise scanned concrete into restrained warm architectural plaster
  // and polished gallery concrete without hiding the real photo detail.
  const mean=mode==='walls'?244:mode==='plinth'?241:mode==='floor'?204:216;
  const contrast=mode==='walls'?.28:mode==='plinth'?.22:.52;
  for(let i=0;i<d.length;i+=4){
    const lum=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
    const value=Math.max(90,Math.min(254,mean+(lum-128)*contrast));
    if(mode==='walls'||mode==='plinth'){
      d[i]=Math.min(255,value+5);
      d[i+1]=Math.min(255,value+2);
      d[i+2]=Math.max(0,value-5);
    }else if(mode==='brick-black'){
      // ambientCG Bricks055 has grey-brown albedo; retain the photographed
      // mortar/brick relief while turning it into black charcoal masonry.
      // This is a colour adaptation of the specified CC0 texture.
      const charcoal=Math.max(21,Math.min(80,38+(lum-106)*.28));
      d[i]=charcoal*.94;d[i+1]=charcoal*.99;d[i+2]=charcoal*1.035;
    }else{
      d[i]=Math.min(255,value+3);
      d[i+1]=Math.min(255,value+2);
      d[i+2]=Math.max(0,value-1);
    }
  }
  ctx.putImageData(frame,0,0);
  return canvas;
}
function tintTimber(source,variant){
  const c=document.createElement('canvas');
  c.width=source.width;c.height=source.height;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(source,0,0);
  const image=g.getImageData(0,0,c.width,c.height),data=image.data;
  // Three tonal studies from one 1K photographic source. No extra downloads.
  const gains=variant===1?[1.06,1.055,1.035]:[.91,.92,.93];
  const bias=variant===1?[7,8,6]:[6,5,4];
  for(let i=0;i<data.length;i+=4){
    for(let n=0;n<3;n++)data[i+n]=Math.max(0,Math.min(255,
      data[i+n]*gains[n]+bias[n]));
  }
  g.putImageData(image,0,0);
  return c;
}
function fallbackCanvas(mode){
  // Lightweight neutral fallback, not a misleading substitute for a loaded
  // Poly Haven scan. Architectural surfaces remain usable offline.
  const c=document.createElement('canvas');
  c.width=128;c.height=128;
  const ctx=c.getContext('2d'),img=ctx.createImageData(128,128);
  const seed={walls:57,floor:83,plinth:31,timber:121}[mode]||57;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const i=(y*128+x)*4;
    const h=((x*73856093)^(y*19349663)^(seed*83492791))>>>0;
    const ripple=Math.sin((x+seed)*.075)*2.1+Math.cos((y-seed)*.054)*1.5;
    const grain=(((h>>>12)&255)/255-.5)*4.2+ripple;
    const base=mode==='walls'?240:mode==='plinth'?235:mode==='timber'?193:202;
    const r=base+grain,g=base+grain-(mode==='timber'?12:2),b=base+grain-(mode==='timber'?26:7);
    img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  return c;
}
function brickFallback(){
  // A quiet, locally generated running-bond brick remains visible when the
  // CDN is unavailable. It is replaced by the real 1K Poly Haven scan.
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const g=c.getContext('2d');
  g.fillStyle='#25292b';g.fillRect(0,0,256,256);
  for(let row=0;row<8;row++){
    const y=row*32+2,shift=(row%2)*32;
    for(let column=-1;column<5;column++){
      const x=column*64+shift+2;
      const h=((row*197+column*149)^(row*column*31))>>>0;
      const light=h%5;
      g.fillStyle=['#35383b','#2b2f32','#404246','#24282b','#303437'][light];
      g.fillRect(x,y,60,28);
      g.strokeStyle='rgba(5,7,8,.24)';
      g.beginPath();g.moveTo(x+2,y+25);g.lineTo(x+58,y+25);g.stroke();
      for(let k=0;k<9;k++){
        const px=x+((h+k*37)%58),py=y+((h+k*19)%27);
        g.fillStyle=k%2?'rgba(65,56,44,.035)':'rgba(255,255,255,.035)';
        g.fillRect(px,py,2+(k%3),1+(k%2));
      }
    }
  }
  return c;
}
export function tiledBoxUvs(geometry,w,h,d,tileMeters=2.5){
  // BoxGeometry packs six sides in 4-vertex groups (+X,-X,+Y,-Y,+Z,-Z).
  // Tiling in physical metres prevents a 9 m wall from stretching one texel
  // over its entire surface; shared texture objects remain identical.
  const uv=geometry.getAttribute('uv');
  if(!uv||uv.count<24)return geometry;
  const scales=[
    [d,h],[d,h],[w,d],[w,d],[w,h],[w,h]
  ];
  for(let face=0;face<6;face++){
    const [uScale,vScale]=scales[face].map(length=>Math.max(.001,length/tileMeters));
    for(let v=0;v<4;v++){
      const i=face*4+v;
      uv.setXY(i,uv.getX(i)*uScale,uv.getY(i)*vScale);
    }
  }
  uv.needsUpdate=true;
  return geometry;
}
export function createArchitecturalMaterials(THREE,{lowPower=false,startAfter=null,renderer=null}={}){
  const textureLoader=new THREE.TextureLoader();
  // Neutral canvas maps are ready immediately; external textures must not
  // compete with the early tower download on slow/mobile connections.
  const ready=startAfter
    ?Promise.race([Promise.resolve(startAfter).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,4000))])
    :null;
  const loader={
    load(...args){
      if(!ready)return textureLoader.load(...args);
      ready.then(()=>textureLoader.load(...args)).catch(error=>console.warn('Optional gallery texture unavailable',error));
      return null;
    }
  };
  const make=(color,roughness,tileMeters,metalness=0)=>{
    const material=new THREE.MeshStandardMaterial({color,roughness,metalness});
    material.userData.tileMeters=tileMeters;
    // A single material bank survives lift/edition changes. Disposal of
    // per-edition mesh geometry must not dispose the shared 1K material maps.
    material.userData.galleryPersistent=true;
    return material;
  };
  // The uploaded wall scan and acoustic ceiling are now the production finishes.
  const uploadedTest=true;
  const wall=make(uploadedTest?'#ffffff':'#faf4ea',.96,uploadedTest?2.2:2.7);
  const floor=make('#e1ddd2',.90,2.25);
  const timber=make('#e6daca',.87,2.3);
  const timberLight=make('#f0e6d7',.89,2.3);
  const timberSmoked=make('#d5c9b7',.92,2.3);
  const timberVariants=[timber,timberLight,timberSmoked];
  const plinth=make('#f6f1e9',.90,1.15);
  // ambientCG OfficeCeiling001 (CC0): a subtle physical acoustic ceiling
  // grid. 3.85m real-world tile repeat, with safe neutral canvas fallback.
  const ceiling=make(uploadedTest?'#ffffff':'#f0eee7',.91,uploadedTest?2.6:3.85);
  // A quieter secondary floor finish permits stone in selected gallery rooms.
  const stone=make('#e6e1d8',.92,1.65);
  const stoneBridge=make('#dedbd3',.91,2.25);
  const exteriorBrick=make('#ffffff',.94,MATERIAL_SOURCES.brick.tileMeters);
  stoneBridge.side=THREE.DoubleSide;
  const trims=make('#625f58',.66,.8,.15);
  const fallback={
    wall:fallbackCanvas('walls'),floor:fallbackCanvas('floor'),
    timber:fallbackCanvas('timber'),plinth:fallbackCanvas('plinth')
  };
  const tx=(canvas)=>{
    const t=new THREE.CanvasTexture(canvas);
    t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=lowPower?1:4;
    return t;
  };
  wall.map=tx(fallback.wall);floor.map=tx(fallback.floor);
  timber.map=tx(fallback.timber);
  timberLight.map=tx(tintTimber(fallback.timber,1));
  timberSmoked.map=tx(tintTimber(fallback.timber,2));
  plinth.map=tx(fallback.plinth);
  ceiling.map=tx(fallback.plinth);
  stoneBridge.map=floor.map;stone.map=floor.map;
  exteriorBrick.map=tx(brickFallback());
  const diagnostics={loaded:[],failed:[],lowPower,source:'ambientCG Bricks055 CC0 / Poly Haven CC0'};
  const locallyLoaded=new Set();
  function scan(slot,url,mode,targets){
    loader.load(url,imageTexture=>{
      try{
        const next=tx(tintScan(imageTexture.image,mode,lowPower?384:768));
        for(const material of targets) {
          if(locallyLoaded.has(material))continue;
          material.map=next;material.needsUpdate=true;
        }
        diagnostics.loaded.push(slot);
        imageTexture.dispose();
      }catch(error){diagnostics.failed.push(slot);}
    },undefined,()=>diagnostics.failed.push(slot));
  }
  function normal(slot,url,targets,strength){
    if(lowPower)return;
    loader.load(url,texture=>{
      texture.wrapS=THREE.RepeatWrapping;
      texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=2;
      for(const material of targets){
        material.normalMap=texture;
        material.normalScale=new THREE.Vector2(strength,strength);
        material.needsUpdate=true;
      }
      diagnostics.loaded.push(slot);
    },undefined,()=>diagnostics.failed.push(slot));
  }
  // Do not overlay the unrelated Poly Haven wall normal on the uploaded scan.
  normal('floor-normal',MATERIAL_SOURCES.floors.normal,[floor,stoneBridge],.21);
  loader.load(MATERIAL_SOURCES.timber.diffuse,source=>{
    try{
      const base=tintScan(source.image,'timber',lowPower?384:1024);
      const maps=[base,tintTimber(base,1),tintTimber(base,2)];
      for(let i=0;i<timberVariants.length;i++){
        timberVariants[i].map=tx(maps[i]);
        timberVariants[i].needsUpdate=true;
      }
      diagnostics.loaded.push('wood-three-tones');
    }catch(error){diagnostics.failed.push('wood-three-tones');}
    source.dispose();
  },undefined,()=>diagnostics.failed.push('wood-three-tones'));
  // A real scanned 1K brick and subtle OpenGL normal relief replace the flat
  // procedural exterior tile. Both requests are optional; geometry is unchanged.
  scan('brick-color',MATERIAL_SOURCES.brick.diffuse,'brick-black',[exteriorBrick]);
  // TEST ONLY, opt in with ?ktx2=1. Preserve the untouched source JPG as
  // the default and as a fallback for unavailable/unsupported KTX2 assets.
  // Normal maps stay linear, and are not packed into XY-only normal mode.
  const benchParams=new URLSearchParams(location.search);
  // Test-only, texture-cold A/B. Distinct URLs guarantee fresh HTTP transfers
  // for these three architectural maps, even when the rest of the gallery is
  // warm in the same browser session. No production cache behaviour changes.
  const coldTextureSeed=benchParams.get('coldseed')||null;
  const textureURL=url=>{
    if(!coldTextureSeed)return url;
    const resource=new URL(url,document.baseURI);
    resource.searchParams.set('ktxCold',coldTextureSeed);
    return resource.href;
  };
  const ktxMode=benchParams.get('ktx2');
  const ktxPilot=!!renderer&&!lowPower&&ktxMode==='1';
  const ktxMulti=!!renderer&&!lowPower&&ktxMode==='multi';
  const ktxDiagnostics=globalThis.__phiKTX2Pilot={
    requested:ktxMode==='1'||ktxMode==='multi',enabled:ktxPilot||ktxMulti,
    mode:ktxMulti?'multi':ktxPilot?'single':'off',
    asset:'Bricks055_NormalGL',status:ktxPilot||ktxMulti?'preparing':'off',
    assets:{}
  };
  if(ktxPilot){
    Promise.resolve(ready).catch(()=>{}).then(async()=>{
      const {KTX2Loader}=await import('three/addons/loaders/KTX2Loader.js');
      const transcoder=new KTX2Loader()
        .setTranscoderPath(new URL('../../test/virtual-gallery/basis/',document.baseURI).href)
        .setWorkerLimit(2)
        .detectSupport(renderer);
      try{
        const texture=await transcoder.loadAsync(
          textureURL('../../test/virtual-gallery/textures/Bricks055_NormalGL.ktx2')
        );
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.anisotropy=2;
        exteriorBrick.normalMap=texture;
        exteriorBrick.normalScale=new THREE.Vector2(.19,.19);
        exteriorBrick.needsUpdate=true;
        ktxDiagnostics.status='loaded';
        ktxDiagnostics.compressed=!!texture.isCompressedTexture;
        ktxDiagnostics.mipLevels=texture.mipmaps?.length||0;
        diagnostics.loaded.push('brick-normal-ktx2-pilot');
      }finally{transcoder.dispose();}
    }).catch(error=>{
      ktxDiagnostics.status='fallback-jpg';
      ktxDiagnostics.error=String(error?.message||error);
      normal('brick-normal',textureURL(MATERIAL_SOURCES.brick.normal),[exteriorBrick],.19);
    });
  }else if(!ktxMulti)normal('brick-normal',textureURL(MATERIAL_SOURCES.brick.normal),[exteriorBrick],.19);
  if(!ktxMulti)loader.load(textureURL(MATERIAL_SOURCES.brick.roughness),texture=>{
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    exteriorBrick.roughnessMap=texture;
    exteriorBrick.needsUpdate=true;
    diagnostics.loaded.push('ambientcg-bricks055-roughness');
  },undefined,()=>diagnostics.failed.push('ambientcg-bricks055-roughness'));
  // Downloaded once from same-origin assets, not from a third-party API
  // during gallery start. Optional maps can fail independently; the roof
  // remains solid and navigable throughout.
  const ceilingDir='./textures/OfficeCeiling001_';
  loader.load(ceilingDir+'Color.jpg',texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=lowPower?1:2;
    ceiling.map=texture;
    ceiling.needsUpdate=true;
    diagnostics.loaded.push('ambientcg-office-ceiling-color');
  },undefined,()=>diagnostics.failed.push('ambientcg-office-ceiling-color'));
  if(!lowPower&&!ktxMulti){
    loader.load(textureURL(ceilingDir+'NormalGL.jpg'),texture=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      ceiling.normalMap=texture;
      ceiling.normalScale=new THREE.Vector2(.18,.18);
      ceiling.needsUpdate=true;
      diagnostics.loaded.push('ambientcg-office-ceiling-normal');
    },undefined,()=>diagnostics.failed.push('ambientcg-office-ceiling-normal'));
  }
  loader.load(ceilingDir+'Roughness.jpg',texture=>{
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    ceiling.roughnessMap=texture;
    ceiling.needsUpdate=true;
    diagnostics.loaded.push('ambientcg-office-ceiling-roughness');
  },undefined,()=>diagnostics.failed.push('ambientcg-office-ceiling-roughness'));
  // A/B TEST ONLY: three normal/roughness maps, never paintings or colour
  // scans. Original JPGs remain the baseline and independent per-map fallbacks.
  if(ktxMulti){
    const assets=[
      {name:'brick-normal',file:'Bricks055_NormalGL',source:MATERIAL_SOURCES.brick.normal,
       material:exteriorBrick,property:'normalMap',strength:.19},
      {name:'brick-roughness',file:'Bricks055_Roughness',source:MATERIAL_SOURCES.brick.roughness,
       material:exteriorBrick,property:'roughnessMap'},
      {name:'ceiling-normal',file:'OfficeCeiling001_NormalGL',source:ceilingDir+'NormalGL.jpg',
       material:ceiling,property:'normalMap',strength:.18}
    ];
    const fallback=entry=>{
      if(entry.property==='normalMap'){
        normal(entry.name,textureURL(entry.source),[entry.material],entry.strength);
      }else{
        loader.load(textureURL(entry.source),texture=>{
          texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
          entry.material[entry.property]=texture;entry.material.needsUpdate=true;
          diagnostics.loaded.push(entry.name+'-fallback');
        },undefined,()=>diagnostics.failed.push(entry.name+'-fallback'));
      }
    };
    Promise.resolve(ready).catch(()=>{}).then(async()=>{
      const {KTX2Loader}=await import('three/addons/loaders/KTX2Loader.js');
      const transcoder=new KTX2Loader()
        .setTranscoderPath(new URL('../../test/virtual-gallery/basis/',document.baseURI).href)
        .setWorkerLimit(2).detectSupport(renderer);
      try{
        await Promise.all(assets.map(async entry=>{
          const started=performance.now();
          try{
            const texture=await transcoder.loadAsync(
              textureURL('../../test/virtual-gallery/textures/'+entry.file+'.ktx2'));
            texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=2;
            if(!texture.isCompressedTexture)throw new Error('Decoded asset is not GPU compressed');
            entry.material[entry.property]=texture;
            if(entry.property==='normalMap')entry.material.normalScale=new THREE.Vector2(entry.strength,entry.strength);
            entry.material.needsUpdate=true;
            ktxDiagnostics.assets[entry.name]={
              status:'loaded',ms:Math.round(performance.now()-started),
              compressed:true,mipLevels:texture.mipmaps?.length||0,
              bytes:texture.mipmaps?.reduce((sum,m)=>sum+(m.data?.byteLength||0),0)||0
            };
            diagnostics.loaded.push('ktx2-'+entry.name);
          }catch(error){
            ktxDiagnostics.assets[entry.name]={status:'fallback-jpg',error:String(error?.message||error)};
            fallback(entry);
          }
        }));
      }finally{transcoder.dispose();}
      ktxDiagnostics.status=assets.every(e=>ktxDiagnostics.assets[e.name]?.status==='loaded')?'loaded':'partial-fallback';
      ktxDiagnostics.compressedCount=assets.filter(e=>ktxDiagnostics.assets[e.name]?.status==='loaded').length;
    }).catch(error=>{
      ktxDiagnostics.status='fallback-jpg';ktxDiagnostics.error=String(error?.message||error);
      for(const entry of assets)if(!ktxDiagnostics.assets[entry.name]){
        ktxDiagnostics.assets[entry.name]={status:'fallback-jpg',error:ktxDiagnostics.error};
        fallback(entry);
      }
    });
  }
  // Use the CC0 Poly Haven plaster for both wall and plinth to avoid remote duplication.
  // Local colour scans are preferred from the outset. Canvas fallback materials
  // keep the exhibition usable even if an optional scan is unavailable.
  for(const [slot,url,mode,targets] of [
    ['oga-walls',LOCAL_TEXTURES.walls,'walls',uploadedTest?[plinth]:[wall,plinth]],
    ['oga-floors',LOCAL_TEXTURES.floors,'floor',[floor]],
    ['oga-stone',LOCAL_TEXTURES.stone,'floor',[stone]]
  ]){
    loader.load(url,texture=>{
      try {
        const next=tx(tintScan(texture.image,mode,lowPower?384:768));
        for(const target of targets){target.map=next;target.needsUpdate=true;locallyLoaded.add(target);}
        diagnostics.loaded.push(slot);texture.dispose();
      }catch(_){diagnostics.failed.push(slot);}
    },undefined,()=>diagnostics.failed.push(slot));
  }
  if(uploadedTest){
    // Use the CC0 Poly Haven wall photograph in both live and test galleries.
    loader.load(LOCAL_TEXTURES.walls,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=lowPower?1:4;
      wall.map=texture;wall.needsUpdate=true;
      diagnostics.loaded.push('polyhaven-wall-original');
    },undefined,()=>diagnostics.failed.push('uploaded-wall-original'));
  }
  let finish='stone';
  const finishFor=()=>finish;
  const setFinish=next=>{
    if(!FINISHES.includes(next))return finish;
    finish=next;
    return finish;
  };
  const floorForRoom=(date,index,roomCount)=>{
    if(roomCount<4)return floor;
    // Daily layouts retain their own finish rhythm; no runtime randomness.
    let seed=2166136261;
    for(const char of String(date)+':'+index){
      seed^=char.charCodeAt(0);seed=Math.imul(seed,16777619);
    }
    const h=(seed>>>0)%11;
    // At least one timber room in each multiroom edition; its tone varies
    // with the actual day seed. Other rooms remain primarily pale concrete.
    if(index===2)return timberVariants[((seed>>>6)>>>0)%3];
    return h===3?stone:(h===1||h===5)?
      timberVariants[((seed>>>6)>>>0)%3]:floor;
  };
  return {wall,floor,timber,timberVariants,floorForRoom,exteriorBrick,ceiling,
    stone,plinth,stoneBridge,trims,diagnostics,
    setFinish,finishFor,lowPower};
}
