// External score/performance evidence check (source: published trackswitch.js demo).
// This validates two musical form boundaries in the exact Robin Alciatore
// 2:14 Mozart recording, rather than only comparing two of our own DTW runs.
// It does NOT certify every score bar, and the Debussy recording has no
// matched independently annotated performance currently available.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GRAMOPHONE_SCORE_MAP} from '../gallery/visit/phi-gramophone-score-map.mjs';

export const EXTERNAL_MOZART_ANCHORS={
  performer:'Robin Alciatore',
  score:'Mozart K.545 I. Allegro, omitted written repeats',
  recording:'https://commons.wikimedia.org/wiki/File:Wolfgang_Amadeus_Mozart_-_sonata_no._16_in_c_major,_k.545_%27sonata_facile%27_-_i._allegro.ogg',
  published:'https://audiolabs.github.io/trackswitch.js/use-cases/repeated-section/',
  actualAnnotations:'https://github.com/audiolabs/trackswitch.js/blob/master/docs/use-cases/repeated-section/alciatore-markers.csv',
  // The external annotation lists these form onsets for Robin Alciatore.
  sections:[{name:'development',time:51.270,bar:29},{name:'recapitulation',time:73.096,approxBar:42}],
};

test('independent research confirms source recording, repeat policy, and exposition ending',()=>{
 const src='./audio/mozart-k545-allegro.ogg';
 const map=GRAMOPHONE_SCORE_MAP[src];
 assert.equal(map.scoreBars,73);
 assert.equal(map.repeat,'no_repeats');
 assert.ok(Math.abs(map.duration-133.87755102)<.01);
 const development=EXTERNAL_MOZART_ANCHORS.sections[0];
 assert.ok(Math.abs(map.starts[development.bar-1]-development.time)<.75,
  'bar 29 must agree with independent Alciatore exposition-to-development annotation');
});

test('independent recapitulation onset falls near matched measure 42',()=>{
 const map=GRAMOPHONE_SCORE_MAP['./audio/mozart-k545-allegro.ogg'];
 const recap=EXTERNAL_MOZART_ANCHORS.sections[1];
 assert.ok(Math.abs(map.starts[recap.approxBar-1]-recap.time)<2,
  'recapitulation must be near external form boundary; our map is not note-level certified');
});

test('unmatched Debussy reference performances cannot validate Giorgi Latso timestamps',()=>{
 const map=GRAMOPHONE_SCORE_MAP['./audio/debussy-reflets-dans-leau.ogg'];
 assert.equal(map.scoreBars,94);
 // ASAP annotations are separate MAESTRO recordings, not this 5:33 Latso performance:
 const asap='https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau';
 assert.match(asap,/Reflets_dans_lEau/);
 // Externally cross-validated two anchor points for Mozart only.
 const ui=readFileSync(new URL('../gallery/visit/phi-gramophone-timeline.mjs',import.meta.url),'utf8');
 assert.match(ui,/automatically cross-checked|computationally cross-checked/);
});
