// Live gallery soundtrack: original Debussy and Mozart performances plus
// six CC-licensed classical recordings. Everything stays off until visitor play.
// Legacy export name retained for compatibility with the existing tower.
import {createGramophoneRecord as makeRecord,RECEPTION_RECORD} from './gramophone-record.mjs?v=selectable-tracks-20261027';

const CLASSICAL_ADDITIONS=Object.freeze([
 Object.freeze({
  title:'La cathédrale engloutie',composer:'Claude Debussy',
  src:'./audio/debussy-la-cathedrale-engloutie.m4a',
  credit:'Ivan Ilić · recorded April 2006 · CC BY 3.0',
  source:'https://commons.wikimedia.org/wiki/File:La_Cath%C3%A9drale_engloutie_-_Claude_Debussy_-_performed_by_Ivan_Ilic.ogg'
 }),
 Object.freeze({
  title:'Clair de lune (Suite bergamasque)',composer:'Claude Debussy',
  src:'./audio/debussy-clair-de-lune.m4a',
  credit:'Laurens Goedhart · 2011 · CC BY 3.0',
  source:'https://commons.wikimedia.org/wiki/File:Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg'
 }),
 Object.freeze({
  title:'Pavane pour une infante défunte',composer:'Maurice Ravel',
  src:'./audio/ravel-pavane.m4a',
  credit:'Thérèse Dussaut · recorded 1976 · CC BY-SA 2.0',
  source:'https://commons.wikimedia.org/wiki/File:Maurice_Ravel_-_Th%C3%A9r%C3%A8se_Dussaut_-_Pavane_pour_une_infante_d%C3%A9funte.ogg'
 }),
 Object.freeze({
  title:'Gymnopédie No. 1',composer:'Erik Satie',
  src:'./audio/satie-gymnopedie-1-macleod.m4a',
  credit:'Arrangement and performance: Kevin MacLeod · CC BY 3.0',
  source:'https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1_(ISRC_USUAN1100787).mp3'
 }),
 Object.freeze({
  title:'Cello Suite No. 1 in G major, BWV 1007 — Prelude',composer:'Johann Sebastian Bach',
  src:'./audio/bach-cello-suite-1-prelude.m4a',
  credit:'Darrell Jacobi · CC BY 3.0',
  source:'https://commons.wikimedia.org/wiki/File:IMSLP173147-PMLP164349-Bach_BWV1007_CelloSuite1_01_darjac.ogg'
 }),
 Object.freeze({
  title:'Première Arabesque',composer:'Claude Debussy',
  src:'./audio/debussy-premiere-arabesque.m4a',
  credit:'Patrizia Prati · live piano performance 2016 · CC BY-SA 4.0',
  source:'https://commons.wikimedia.org/wiki/File:Claude_Debussy_-_Premi%C3%A8re_Arabesque_-_Patrizia_Prati.ogg'
 })
]);
export const RECEPTION_RECORD_ASAP_TEST=Object.freeze([
 Object.freeze({
  ...RECEPTION_RECORD[0],
  src:'./audio/debussy-reflets-asap-kleisen.ogg',
  credit:'MAESTRO 2008 performance · ASAP aligned score by Foscarin et al. · CC BY-NC-SA 4.0',
  source:'https://github.com/fosfrancesco/asap-dataset/tree/master/Debussy/Images_Book_1/1_Reflets_dans_lEau'
 }),
 RECEPTION_RECORD[1],
 ...CLASSICAL_ADDITIONS
]);
export function createGramophoneRecord(options={}){
 return makeRecord({...options,tracks:RECEPTION_RECORD_ASAP_TEST});
}
