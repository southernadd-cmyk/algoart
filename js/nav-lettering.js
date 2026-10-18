/* ALGO/ART nav lettering: a separate lowercase, hand-drawn marker alphabet.
   SVG paths stay visual only; the original link text remains accessible. */
(()=>{'use strict';
const glyph={
 a:'M1 5 C1 2 6 2 6 5 C6 8 1 8 1 5 M6 3 L6 7',
 b:'M1 0 L1 7 M1 4 C3 2 7 3 7 5 C7 8 3 8 1 6',
 c:'M7 3 C3 2 1 3 1 5 C1 7 4 8 7 7',
 d:'M7 0 L7 7 M7 4 C5 2 1 3 1 5 C1 8 5 8 7 6',
 e:'M1 5 L7 5 C7 2 1 2 1 5 C1 8 5 8 7 7',
 f:'M2 7 L3 2 C3 0 5 -1 7 1 M1 3 L6 3',
 g:'M7 3 L7 8 C7 11 3 11 1 9 M7 4 C5 2 1 3 1 5 C1 8 5 8 7 6',
 h:'M1 0 L1 7 M1 4 C3 2 7 2 7 5 L7 7',
 i:'M3 3 L3 7 M3 0 L3.1 .2',
 j:'M5 3 L5 8 C5 11 2 11 1 9 M5 0 L5.1 .2',
 k:'M1 0 L1 7 M7 3 L1 5 L7 7',
 l:'M3 0 L3 7',
 m:'M1 7 L1 3 M1 4 C2 2 4 2 4 5 L4 7 M4 4 C6 2 8 2 8 5 L8 7',
 n:'M1 7 L1 3 M1 4 C3 2 7 2 7 5 L7 7',
 o:'M1 5 C1 2 7 2 7 5 C7 8 1 8 1 5',
 p:'M1 3 L1 10 M1 4 C3 2 7 3 7 5 C7 8 3 8 1 6',
 q:'M7 3 L7 10 M7 4 C5 2 1 3 1 5 C1 8 5 8 7 6',
 r:'M1 7 L1 3 M1 4 C3 2 5 2 7 3',
 s:'M7 3 C4 2 1 3 1 4 C1 5 7 5 7 6 C7 8 3 8 1 7',
 t:'M3 1 L3 6 C3 8 5 8 7 7 M1 3 L6 3',
 u:'M1 3 L1 5 C1 8 5 8 7 5 M7 3 L7 7',
 v:'M1 3 L4 7 L7 3',
 w:'M1 3 L2.5 7 L4.5 4 L6.5 7 L8 3',
 x:'M1 3 L7 7 M7 3 L1 7',
 y:'M1 3 L4 7 L7 3 L4 10 C3 11 2 11 1 10',
 z:'M1 3 L7 3 L1 7 L7 7',
 '/':'M1 8 L7 0', ' ':'', 'φ':'M4 2 L4 9 M4 3 C1 2 0 4 1 6 C2 8 7 8 8 5 C8 3 6 2 4 3',
 '·':'M2 5 L2.1 5.1'
};
function svgFor(value){
 const text=value.toLocaleLowerCase('en-GB'), ns='http://www.w3.org/2000/svg';
 let x=1, parts=[];
 for(const char of text){const path=glyph[char];const width=char===' '?4:char==='i'||char==='l'||char==='j'?5:char==='m'||char==='w'?10:9;
 if(path)parts.push('<path transform="translate('+x+' 1)" d="'+path+'"/>');
 x+=width;}
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+(x+1)+' 14');
 svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('algo-nav-ink');
 const ink=document.createElementNS(ns,'g');ink.setAttribute('fill','none');ink.setAttribute('stroke','currentColor');ink.setAttribute('stroke-linecap','round');ink.setAttribute('stroke-linejoin','round');ink.setAttribute('stroke-width','1.22');ink.innerHTML=parts.join('');svg.appendChild(ink);
 // A second dry marker pass adds a little hand-made density.
 const pass=ink.cloneNode(true);pass.setAttribute('stroke-width','.27');pass.setAttribute('opacity','.35');pass.setAttribute('transform','translate(.13 .13)');svg.appendChild(pass);
 return svg;
}
function render(){document.querySelectorAll('[data-algo-nav]').forEach(el=>{if(el.querySelector('.algo-nav-ink'))return;const label=el.textContent.trim().toLowerCase();el.setAttribute('aria-label',label);el.textContent='';const hidden=document.createElement('span');hidden.className='algo-nav-readable';hidden.textContent=label;el.append(hidden,svgFor(label));});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
