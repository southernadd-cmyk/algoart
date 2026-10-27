import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MATERIAL_SOURCES,LOCAL_TEXTURES,tiledBoxUvs,createArchitecturalMaterials
} from '../../gallery/visit/architectural-materials.mjs';

function uvGeometry(){
  const data=[
    // +X face (4), -X (4), +Y, -Y, +Z, -Z.
    ...Array.from({length:6},()=>[0,1,1,1,0,0,1,0]).flat()
  ];
  const attribute={
    count:24,
    getX:i=>data[2*i],getY:i=>data[2*i+1],
    setXY(i,u,v){data[2*i]=u;data[2*i+1]=v}
  };
  return {getAttribute(key){return key==='uv'?attribute:null},data,needsUpdate:false};
}
test('Source assets are credited Poly Haven and ambientCG CC0 maps',()=>{
  assert.equal(Object.keys(MATERIAL_SOURCES).length,4);
  for(const entry of Object.values(MATERIAL_SOURCES)){
    assert.equal(entry.license,'CC0-1.0');
    if(entry.author==='ambientCG'){
      assert.equal(entry.asset,'Bricks055');
      assert.equal(entry.source,'https://ambientcg.com/view?id=Bricks055');
      assert.equal(entry.diffuse,'./textures/Bricks055_Color.jpg');
      assert.equal(entry.normal,'./textures/Bricks055_NormalGL.jpg');
      assert.equal(entry.roughness,'./textures/Bricks055_Roughness.jpg');
    }else{
      assert.equal(entry.author,'Poly Haven');
      assert.ok(entry.diffuse.includes('/Textures/jpg/1k/'));
      assert.ok(entry.diffuse.startsWith('https://dl.polyhaven.org/'));
      if(entry.normal)assert.ok(entry.normal.includes('_nor_gl_1k.jpg'));
    }
    assert.ok(entry.tileMeters>1);
  }
});
test('Box UVs repeat proportionally to metre-scale geometry dimensions',()=>{
  const geometry=uvGeometry(),before=geometry.data.slice();
  const result=tiledBoxUvs(geometry,10,4,6,2);
  assert.equal(result,geometry);
  assert.equal(geometry.data[2],3); // X-facing: 6 m side / 2 m tile
  assert.equal(geometry.data[3],2); // 4 m high / 2 m tile
  assert.equal(geometry.data[18],5); // top face: 10 m width / 2 m tile
  assert.equal(geometry.data[19],3); // top face: 6 m depth / 2 m tile
  assert.equal(geometry.data[34],5); // Z-facing 10 m width
  assert.equal(geometry.data[35],2); // Z-facing 4 m height
});
test('No-UV geometry is left untouched',()=>{
  const geometry={getAttribute(){return null}};
  assert.equal(tiledBoxUvs(geometry,5,5,5),geometry);
});
test('Offline mobile/VR fallback has real materials, shared floor/bridge map, no normal downloads',()=>{
  const originalDocument=globalThis.document;
  const calls=[];
  class FakeMaterial{constructor(props){Object.assign(this,props);this.userData={};this.needsUpdate=false;}}
  class FakeCanvasTexture{constructor(canvas){this.image=canvas;}}
  class FakeLoader{load(url,onLoad,onProgress,onError){calls.push(url);onError?.(new Error('offline'));}}
  const THREE={
    MeshStandardMaterial:FakeMaterial,
    TextureLoader:FakeLoader,
    CanvasTexture:FakeCanvasTexture,
    SRGBColorSpace:'srgb',
    RepeatWrapping:'repeat',
    DoubleSide:2,
    Vector2:class {constructor(x,y){this.x=x;this.y=y}}
  };
  // The canvas mock is enough to exercise the fallback without browsers.
  globalThis.document={
    createElement(tag){
      assert.equal(tag,'canvas');
      const canvas={width:0,height:0};
      canvas.getContext=()=>({
        createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
        drawImage(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
        getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)}},
        putImageData(){}
      });
      return canvas;
    }
  };
  try{
    const bank=createArchitecturalMaterials(THREE,{lowPower:true});
    assert.ok(bank.wall.map);
    assert.ok(bank.floor.map);
    assert.ok(bank.timber.map);
    assert.ok(bank.plinth.map);
    assert.equal(bank.stoneBridge.map,bank.floor.map);
    assert.ok(bank.wall.userData.tileMeters>2);
    assert.equal(bank.wall.normalMap,undefined);
    assert.deepEqual(calls,[
      MATERIAL_SOURCES.timber.diffuse,MATERIAL_SOURCES.brick.diffuse,
      MATERIAL_SOURCES.brick.roughness,'./textures/OfficeCeiling001_Color.jpg',
      './textures/OfficeCeiling001_Roughness.jpg',LOCAL_TEXTURES.walls,
      LOCAL_TEXTURES.floors,LOCAL_TEXTURES.stone,LOCAL_TEXTURES.walls
    ],'mobile requests only the active colour and roughness maps');
    assert.ok(calls.every(url=>!/_nor_gl_|NormalGL/.test(url)),'mobile must not download normal maps');
    assert.equal(bank.diagnostics.failed.length,calls.length);
    assert.equal(bank.setFinish('timber'),'timber');
    assert.equal(bank.setFinish('unknown'),'timber');
  } finally{globalThis.document=originalDocument}
});
