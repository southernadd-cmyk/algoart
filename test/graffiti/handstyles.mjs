// Original procedural studies of the 50 writers in the user-selected list.
// Names identify the reference; geometry comes from our phi alphabet and the
// distinct movement/shape recipes below. These are not traced signatures.
import {letterDialect,applyLetterDialect,shapeWicket} from './letter-dialects.mjs?v=bold-dialects-v5';
import {applyArtistGesture} from './artist-gestures.mjs?v=artist-grammar-v1';
export const HANDSTYLE_SOURCE='https://www.bombingscience.com/top-50-graffiti-handstyles/';
// id, reference, construction, lean, width, height, weight, spacing, joins,
// baseline swing, finishing gesture, nozzle flare, short study label.
const rows=[
 ['easy','EASY ONE','plain',.13,.96,1,6.4,.5,.12,.35,'underline',1,'Open rhythm'],
 ['skofe','SKOFE ONE','round',.2,1.38,.96,12.8,-1,.82,.75,'sweep',1.9,'Body sweep'],
 ['sicoer','SICOER','script',.36,.78,1.15,6.2,-1.4,.96,.5,'return',1.2,'Linked calligraphy'],
 ['rime','RIME (MSK)','elastic',.24,1.08,1.03,7.2,-.8,.6,1.65,'kick',1.35,'Playful balance'],
 ['revok','REVOK','angular',.12,1.04,1.03,10,-.3,.2,.35,'slash',1.1,'Heavy anchor'],
 ['skuf','SKUF','round',.11,1.3,1,11.8,-.9,.7,.45,'sweep',1.55,'Wide swing'],
 ['chaka','CHAKA','round',.28,1.02,1.03,8.8,-.7,.8,.42,'underline',1.5,'Loop rhythm'],
 ['faust','FAUST','script',.45,.74,1.16,5.1,-1.6,1,.28,'return',1.1,'Fine script'],
 ['curve','CURVE','elastic',.27,1.03,1.09,6.7,-.6,.65,1.25,'loop',1.3,'Flexible curves'],
 ['enem','ENEM (TDK)','wicket',.49,.64,1.62,5.8,-1.1,.94,.5,'kick',1.5,'Tall kickouts'],
 ['optimist','OPTIMIST','plain',.17,.74,1,6.4,-.2,.25,.25,'circle',1,'Tight circle'],
 ['bates','BATES','round',.16,1.03,1.04,8.9,.1,.35,.32,'underline',1.05,'Firm weight'],
 ['soviet','SOVIET','elastic',.24,.92,1.12,7.4,-.6,.7,1.9,'frame',1.25,'Shifting posture'],
 ['twist','TWIST','script',.25,.86,1.04,6.5,-1,.9,1.1,'loop',1.2,'Loose turns'],
 ['daver','DAVER','script',.46,.82,1.2,6.1,-1.1,.85,.72,'kick',1.15,'Slanted swing'],
 ['grey','GREY (PVC)','plain',.05,.87,1.03,6.2,-.4,.08,.1,'slash',1,'Clipped spacing'],
 ['kadism','KADISM','wicket',.32,.5,1.86,5.2,-1.2,.98,.32,'return',1.1,'Long wickets'],
 ['karma','KARMA','wicket',.26,.94,1.34,6.9,.5,.68,.22,'kick',1.25,'Open wickets'],
 ['cecster','CECSTER','plain',.1,.53,1.65,5.3,.25,.04,.18,'underline',1,'Narrow cadence'],
 ['spot','SPOT (KMS)','round',.14,.96,1.01,7.8,.15,.38,.38,'loop',1.1,'Round balance'],
 ['kanser','KANSER','elastic',.36,.89,1.19,6.3,-1.3,.8,1.2,'kick',1.2,'Alternating shapes'],
 ['poster','POSTER','elastic',.26,1.15,1.02,7.2,-.6,.7,1.8,'loop',1.4,'Elastic bounce'],
 ['buster','BUSTER','script',.32,1.42,.93,8.2,-1,.93,.85,'sweep',1.75,'Horizontal reach'],
 ['zeser','ZESER','elastic',.42,1.2,1.13,7.4,-1.3,.8,1.4,'kick',1.55,'Stretched snap'],
 ['zephyr','ZEPHYR','angular',.13,1.01,1.04,8.1,.1,.18,.18,'slash',1,'Measured corners'],
 ['shaken','SHAKEN','plain',.07,.91,.98,5.9,.6,.04,.16,'underline',1,'Spare capitals'],
 ['yorker','YORKER','wicket',.29,.68,1.48,7,-.6,.7,.4,'kick',1.65,'Vertical flare'],
 ['sofles','SOFLES','elastic',.34,1.17,1.1,8.4,-.9,.8,1.5,'return',1.8,'Dynamic turns'],
 ['gorey','GOREY','oneline',.2,1.06,1.02,5.6,-1.4,1,.7,'return',1.1,'Continuous line'],
 ['earsnot','EARSNOT IRAK','round',.22,1.2,1.05,10.5,-1,.68,1,'sweep',1.45,'Heavy swing'],
 ['rame','RAME','wicket',.39,.67,1.5,8,-.7,.83,.65,'kick',1.75,'Bold wickets'],
 ['veefer','VEEFER','script',.25,.79,1.05,6,-1.2,.97,.25,'loop',1.05,'Repeated loops'],
 ['nesta','NESTA (OSD)','angular',.3,1.12,.91,8.8,-.7,.42,.48,'sweep',1.4,'Low stance'],
 ['renos','RENOS','elastic',.37,.83,1.1,6.3,-.9,.87,.65,'return',1.2,'Tight flex'],
 ['hindue','HINDUE','script',.31,.9,1.18,6.6,-.8,.9,.4,'serif',1.2,'Serif script'],
 ['sp-one','SP ONE','plain',.15,.98,1.01,6.9,.4,.16,.3,'underline',1.1,'Simple stance'],
 ['orible','ORIBLE (LORDS)','round',.2,1.2,1.04,9.5,-.45,.55,.4,'sweep',2,'Wide flares'],
 ['zexor','ZEXOR','angular',.26,1.34,1.1,11,-.7,.38,.5,'slash',1.65,'Large angles'],
 ['style','STYLE (LORDS)','round',.16,1.52,.9,13,-.6,.6,.32,'sweep',1.9,'Broad reach'],
 ['sever','SEVER','angular',.18,.94,1.06,7.3,.1,.22,.22,'slash',1.1,'Sharp cadence'],
 ['brite','BRITE BKF','round',.06,1.23,.82,10.5,-1.4,.8,.7,'frame',1.3,'Framed body'],
 ['oclock','O’CLOCK 156','round',.17,1.08,1.02,7.6,-.8,.7,.4,'circle',1.25,'Circular rhythm'],
 ['katsu','KATSU','angular',.08,.79,1.1,7.6,-1.4,.86,.2,'step',1.1,'Interlocked strokes'],
 ['ze-one','ZE ONE','plain',.19,1.02,1.04,7,.2,.24,.32,'underline',1.15,'Balanced flow'],
 ['remio','REMIO','script',.3,.94,1.1,6.9,-1,.92,.8,'kick',1.2,'Open exits'],
 ['adek','ADEK BTM','plain',.11,1.02,1.02,7.1,.4,.1,.18,'underline',1.05,'Clear spacing'],
 ['sliks','SLIKS','round',.28,1.26,1.08,9.4,-.7,.75,.75,'sweep',2.3,'Flared motion'],
 ['sabe','SABE KST','elastic',.47,1.1,1.15,7.7,-1.1,.7,1.8,'kick',1.6,'Asymmetric kick'],
 ['guess','GUESS','script',.23,1.05,1,7,-.6,.84,1.4,'loop',1.15,'Bouncing loops'],
 ['jade','JADE BTM','script',.24,1,1.05,7.2,-.6,.86,.4,'return',1.15,'Even flow']
];
export const REFERENCE_STUDIES=Object.freeze(Object.fromEntries(rows.map(([id,reference,shape,lean,width,height,weight,spacing,join,bounce,gesture,flare,label],i)=>[
 id,Object.freeze({id,name:reference+' study',reference,shape,lean,width,height,weight,spacing,join,bounce,gesture,flare,description:label,order:i+1,source:HANDSTYLE_SOURCE,
 family:shape==='angular'?'cut':shape==='plain'?'rush':'loop',angle:shape==='angular'?-Math.PI/4:.25,dialect:Object.freeze(letterDialect({id}))})
])));

// A second pen-movement alphabet gives connected script and wickets actual
// letter constructions of their own. All body heights still use H/phi.
export function shapeStudyLetter(ch,glyph,style,m){
 const {height:H,width:W,short:a,long:b,unit:u,ratio}=m,k=W/ratio,v=W/ratio**2;
 const L=(...ps)=>ps.map(([x,y])=>({x,y})),P=points=>({points,smooth:true});
 const oval=(cx=W/2,cy=a+b/2,rx=W/2,ry=b/2)=>Array.from({length:29},(_,i)=>{const t=-Math.PI/2+i/28*Math.PI*2;return{x:cx+Math.cos(t)*rx,y:cy+Math.sin(t)*ry};});
 let strokes=glyph.strokes;
 if(['script','wicket'].includes(style.shape)){
  const O=()=>P(oval());
  const forms={
   A:[O(),P(L([W,a],[W,H],[W+u,H-u]))],
   B:[P(L([0,H],[0,u],[v,0],[k,u],[0,b])),O()],
   C:[P(Array.from({length:25},(_,i)=>{const t=-Math.PI/4-i/24*Math.PI*1.5;return{x:W/2+Math.cos(t)*W/2,y:a+b/2+Math.sin(t)*b/2};}))],
   D:[O(),P(L([W,H],[W,0],[W+v,-u],[W+u,a],[W,H]))],
   E:[P(L([0,b],[W,b],[W-u,a+u],[W/2,a],[u,a+u],[0,b],[u,H-u],[W/2,H],[W,H-u]))],
   F:[P(L([-u,b],[v,u],[k,0],[W,u],[v,b],[0,H+v],[v,H+a],[k,H])),P(L([-u,a],[W,a-u]))],
   G:[O(),P(L([W,a],[W,H],[k,H+a],[u,H+a],[0,H+u],[k,H-u]))],
   H:[P(L([0,H],[0,u],[v,0],[k,u],[0,b],[v,a],[k,a],[W,b],[W,H]))],
   I:[P(L([u,a],[u,H],[v,H-u])),P(L([u,a-v],[u,a-v-u/2]))],
   J:[P(L([v,a],[v,H+v],[0,H+a],[-u,H+v])),P(L([v,a-v],[v,a-v-u/2]))],
   K:[P(L([0,H],[0,0],[u,-u],[v,0],[0,b])),P(L([W,a],[0,b],[W,H]))],
   L:[P(L([0,H],[v,u],[k,0],[W,u],[v,b],[0,H],[k,H-u]))],
   M:[P(L([0,H],[0,a],[v,a+u],[v,H],[v,a+u],[k,a],[k,H],[k,a+u],[W,a],[W,H]))],
   N:[P(L([0,H],[0,a],[u,a+u],[0,b],[v,a],[k,a],[W,b],[W,H]))],
   O:[O()],
   P:[P(L([0,H+a],[0,a])),O()],
   Q:[O(),P(L([W,a],[W,H+a],[W+v,H+v]))],
   R:[P(L([0,H],[0,a],[u,a+u],[0,b],[v,a],[k,a],[W,b]))],
   S:glyph.strokes.map(s=>P(s.points.map(p=>({x:p.x,y:a+p.y*b/H})))),
   T:[P(L([v,u],[v,H-u],[k,H],[W,H-u])),P(L([0,a],[W,a-u]))],
   U:[P(L([0,a],[0,H-u],[v,H],[k,H-u],[W,a],[W,H]))],
   V:[P(L([0,a],[v,H],[W,a]))],
   W:[P(L([0,a],[v,H],[W/2,b],[k,H],[W,a]))],
   X:[P(L([0,a],[W,H])),P(L([W,a],[0,H]))],
   Y:[P(L([0,a],[v,H],[W,a],[W,H],[k,H+a],[0,H+a]))],
   Z:[P(L([0,a],[W,a],[0,H],[W,H],[v,H+a],[0,H+a]))]
  };
  if(forms[ch])strokes=forms[ch];
 }
 if(style.shape==='elastic')strokes=strokes.map((s,i)=>({points:s.points.map(p=>({x:p.x+Math.sin(p.y/H*Math.PI)*u*(i%2?-.7:.7),y:p.y})),smooth:true}));
 if(style.id==='remio'&&ch==='R')strokes=[...strokes,P(L([v,a],[k,b],[W+v,H]))];
 if(style.id==='spot'&&ch==='S')strokes=[P(L([W,a/ratio],[k,0],[u,u],[0,a],[k,b],[W,b+u],[k,H],[0,H-u]))];
 let result=applyLetterDialect(ch,{...glyph,strokes},style,m);
 if(style.shape==='wicket')result=shapeWicket(ch,result,style,m);
 return applyArtistGesture(ch,result,style,m);
}
