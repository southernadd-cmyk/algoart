// Test tower only: retain the existing Mozart performance, but substitute the
// fully annotated ASAP/MAESTRO 2008 performance of Debussy's Reflets dans l'eau.
// Production gallery-music.mjs still imports the original gramophone-record.mjs.
import {createGramophoneRecord as makeRecord,RECEPTION_RECORD} from './gramophone-record.mjs?v=selectable-tracks-20261027';
export const RECEPTION_RECORD_ASAP_TEST=Object.freeze([
 Object.freeze({
  ...RECEPTION_RECORD[0],
  src:'./audio/debussy-reflets-asap-kleisen.ogg',
  credit:'MAESTRO 2008 performance · ASAP aligned score by Foscarin et al. · CC BY-NC-SA 4.0',
  source:'https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau'
 }),
 RECEPTION_RECORD[1],
 // These are independently composed, algorithmically rendered PROPORTION PIECE audio.
 // The actual rendered Ogg files are checked into the branch by CI after validation.
 Object.freeze({
  title:'Phi Resonances',composer:'PROPORTION PIECE',analysis:'Original golden-ratio frequency study',
  src:'./audio/phi-resonances.ogg',
  credit:'Original audio study · simultaneous frequencies follow successive powers of φ',
  source:'https://github.com/southernadd-cmyk/algoart/blob/main/automation/generate-phi-music.py'
 }),
 Object.freeze({
  title:'Golden Angle',composer:'PROPORTION PIECE',analysis:'Original golden-angle sequence',
  src:'./audio/golden-angle.ogg',
  credit:'Original audio study · golden-angle phase controls note choice and spatial placement',
  source:'https://github.com/southernadd-cmyk/algoart/blob/main/automation/generate-phi-music.py'
 }),
 Object.freeze({
  title:'Golden Measure',composer:'PROPORTION PIECE',analysis:'Original Fibonacci phrase study',
  src:'./audio/golden-measure.ogg',
  credit:'Original audio study · 34:21:34 structure, climax at 55/89 (61.8%)',
  source:'https://github.com/southernadd-cmyk/algoart/blob/main/automation/generate-phi-music.py'
 })
]);
export function createGramophoneRecord(options={}){
 return makeRecord({...options,tracks:RECEPTION_RECORD_ASAP_TEST});
}
