// Test tower only: retain the existing Mozart performance, but substitute the
// fully annotated ASAP/MAESTRO 2008 performance of Debussy's Reflets dans l'eau.
// Production gallery-music.mjs still imports the original gramophone-record.mjs.
import {createGramophoneRecord as makeRecord,RECEPTION_RECORD} from './gramophone-record.mjs';
export const RECEPTION_RECORD_ASAP_TEST=Object.freeze([
 Object.freeze({
  ...RECEPTION_RECORD[0],
  src:'./audio/debussy-reflets-asap-kleisen.ogg',
  credit:'MAESTRO 2008 performance · ASAP aligned score by Foscarin et al. · CC BY-NC-SA 4.0',
  source:'https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau'
 }),
 RECEPTION_RECORD[1]
]);
export function createGramophoneRecord(options={}){
 return makeRecord({...options,tracks:RECEPTION_RECORD_ASAP_TEST});
}
