import test from 'node:test';
import assert from 'node:assert/strict';
import {paperRGB,estimatePaper,pigmentOpacity,maskPaper} from '../../gallery/visit/paper-isolation.mjs';
import {pigmentGrid,tracePigmentRegions} from '../../gallery/visit/pigment-regions.mjs';
function illustration(){
  const width=96,height=112,data=new Uint8ClampedArray(width*height*4);
  const put=(x,y,rgb)=>{
    const k=(y*width+x)*4;
    data[k]=rgb[0];data[k+1]=rgb[1];data[k+2]=rgb[2];data[k+3]=255;
  };
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    // Deliberate JPEG-style +/- 3 variation, and a warmer paper stock.
    const noise=(x*17+y*31)%7-3;
    const stock=[243+noise,238+noise,228+noise];
    let colour=stock;
    if(x>=16&&x<45&&y>=20&&y<66)colour=[40,59,221]; // blue ink
    if(x>=52&&x<83&&y>=33&&y<75)colour=[231,216,107]; // pale yellow fill
    put(x,y,colour);
  }
  return {width,height,data};
}
test('near-paper pixels are transparent, real paint and pale fills remain',()=>{
  const img=illustration(),paper=estimatePaper(img,'#f5f0e6');
  assert.ok(paper.every((c,i)=>Math.abs(c-[243,238,228][i])<5));
  const paperPoint=(5*img.width+5)*4;
  const blue=(32*img.width+25)*4;
  const pale=(42*img.width+64)*4;
  const isolated=maskPaper(img,'tissue','#f5f0e6');
  assert.equal(isolated.data[paperPoint+3],0);
  assert.equal(isolated.data[blue+3],255);
  assert.ok(isolated.data[pale+3]>80,'intentional pale coloured fill was incorrectly erased');
});
test('the physical pigment mask and the alpha cutout agree on paper',()=>{
  const img=illustration();
  const grid=pigmentGrid(img,'tissue','#f5f0e6');
  assert.ok(grid.coverage>.16&&grid.coverage<.28);
  assert.equal(grid.mask[5*grid.width+5],0);
  assert.equal(grid.mask[32*grid.width+25],1);
  assert.equal(grid.mask[42*grid.width+64],1);
  const shapes=tracePigmentRegions(grid,'tissue','mobile');
  assert.ok(shapes.some(x=>x.area>850));
  assert.ok(shapes.every(x=>x.centroid.x>0&&x.centroid.y>0));
});
test('paper matching accounts for chosen paper tone and different materials',()=>{
  const paper=paperRGB('#e7e3d6');
  assert.equal(pigmentOpacity(230,227,214,paper,'oil'),0);
  assert.equal(pigmentOpacity(30,60,195,paper,'oil'),1);
  assert.ok(pigmentOpacity(218,190,95,paper,'watercolour')>0);
  assert.equal(pigmentOpacity(245,240,230,paperRGB('#f5f0e6'),'marker'),0);
});
test('no alphaMap is used incorrectly as a paper alpha channel',()=>{
  // CanvasTexture carries true RGBA alpha in .map; THREE's alphaMap would
  // use its green channel and reintroduce the pale backdrop.
  const fixture=illustration();
  maskPaper(fixture,'oil','#f5f0e6');
  const clear=[...fixture.data].filter((_,i)=>i%4===3&&fixture.data[i]===0).length;
  assert.ok(clear>fixture.width*fixture.height*.5);
});
