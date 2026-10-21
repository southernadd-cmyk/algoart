import test from 'node:test';
import assert from 'node:assert/strict';
import {sculptureFragments,FRAGMENT_COUNTS,SOLID_SCULPTURE_VERSION} from './sculpture-solids.mjs';
import {ENGINE_FORMS,SCULPTURE_WIDTH,SCULPTURE_HEIGHT} from './sculptures.mjs';

const engines=['field','spiral','rects','burst','network','organic','geometric','scribble'];
function signedArea(vertices){
  return vertices.reduce((sum,p,i)=>{
    const q=vertices[(i+1)%vertices.length];
    return sum+p.x*q.y-q.x*p.y;
  },0)*.5;
}

test('All eight engines produce opaque-extrusion-ready shapes, not flat picture layers',()=>{
  assert.equal(SOLID_SCULPTURE_VERSION,2);
  assert.equal(new Set(Object.values(ENGINE_FORMS)).size,8);
  for(const engine of engines){
    const study={seed:'PP-20261021-'+engine,engine};
    for(const quality of ['desktop','mobile','vr']){
      const pieces=sculptureFragments(study,quality);
      assert.equal(pieces.length,FRAGMENT_COUNTS[quality]);
      assert.deepEqual(pieces,sculptureFragments(study,quality));
      assert.ok(new Set(pieces.map(p=>Math.round(p.depth*100))).size>5,
        engine+' must have real variation in solid thickness');
      assert.ok(new Set(pieces.map(p=>Math.round(p.z*100))).size>5,
        engine+' must vary in three dimensional depth');
      assert.ok(pieces.some(p=>Math.abs(p.tiltX)>.01 || Math.abs(p.tiltY)>.01),
        engine+' must vary shape orientation in 3D');
      for(const piece of pieces){
        assert.equal(piece.form,ENGINE_FORMS[engine]);
        assert.ok(piece.depth>=.2 && piece.depth<=.73);
        assert.ok(piece.vertices.length>=4);
        assert.ok(Math.abs(signedArea(piece.vertices))>.00001,'degenerate polygon');
        assert.ok(piece.vertices.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
        assert.ok(piece.vertices.every(p=>Math.abs(p.x)<=SCULPTURE_WIDTH*.54 &&
          Math.abs(p.y)<=SCULPTURE_HEIGHT*.54),'piece escapes sculpture envelope');
        assert.ok(piece.sample.u>=0 && piece.sample.u<=1);
        assert.ok(piece.sample.v>=0 && piece.sample.v<=1);
      }
    }
  }
});

test('Changing study seed changes the physical object, but preserves its identity on revisit',()=>{
  const original={seed:'CWP-20261021-01-11221',engine:'spiral'};
  const repeat={...original};
  const next={...original,seed:'CWP-20261022-01-11221'};
  assert.deepEqual(sculptureFragments(original),sculptureFragments(repeat));
  assert.notDeepEqual(sculptureFragments(original),sculptureFragments(next));
});

test('Mobile and VR preserve the system while lowering fragment counts',()=>{
  const study={seed:'PP-variant',engine:'organic'};
  assert.ok(sculptureFragments(study,'desktop').length>sculptureFragments(study,'vr').length);
  assert.ok(sculptureFragments(study,'vr').length>sculptureFragments(study,'mobile').length);
  assert.ok(sculptureFragments(study,'mobile').every(p=>p.form==='growth'));
});
