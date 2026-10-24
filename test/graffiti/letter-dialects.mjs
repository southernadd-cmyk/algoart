// Construction choices for the letters that recur most often in short tags.
// These are original study alphabets. A recipe changes pen movements and
// counters before the writer's slant/scale transforms are applied.
// Codes select P, R, O, T, I, N, E, A, H and C; 0 keeps the base hand.
const codes={
 easy:'11011011',skofe:'22020020',sicoer:'33033003',rime:'22120332',revok:'11231131',skuf:'22022022',chaka:'00220022',faust:'00404000',curve:'23420224',enem:'00220000',
 optimist:'13011010',bates:'21021011',soviet:'33233133',twist:'00300202',daver:'34134131',grey:'11011313',kadism:'22222122',karma:'11313111',cecster:'31011111',spot:'02320002',
 kanser:'32332303',poster:'22230223',buster:'30033000',zeser:'34330333',zephyr:'11131111',shaken:'10111010',yorker:'23223123',sofles:'23130232',gorey:'02020000',earsnot:'22023020',
 rame:'22021022',veefer:'00300040',nesta:'31133131',renos:'30330320',hindue:'11034031', 'sp-one':'10011011',orible:'22323022',zexor:'31333133',style:'22033022',sever:'11133113',
 brite:'22221122',oclock:'00420020',katsu:'33131131','ze-one':'10121011',remio:'04033000',adek:'21011013',sliks:'22423024',sabe:'33334333',guess:'00320240',jade:'23023000'
};
const shoulderCodes={easy:'11',skofe:'34',sicoer:'24',rime:'42',revok:'31',skuf:'14',chaka:'43',faust:'24',curve:'42',enem:'23',optimist:'12',bates:'32',soviet:'11',twist:'44',daver:'13',grey:'31',kadism:'31',karma:'14',cecster:'10',spot:'12',kanser:'43',poster:'42',buster:'34',zeser:'43',zephyr:'31',shaken:'11',yorker:'32',sofles:'43',gorey:'44',earsnot:'24',rame:'12',veefer:'44',nesta:'31',renos:'43',hindue:'31','sp-one':'30',orible:'32',zexor:'31',style:'32',sever:'32',brite:'34',oclock:'22',katsu:'11','ze-one':'12',remio:'43',adek:'14',sliks:'12',sabe:'33',guess:'24',jade:'42'};
const letters='PROTINEAHC';
export function letterDialect(style){const code=(codes[style.id]||'00000000')+(shoulderCodes[style.id]||'00');return Object.fromEntries([...letters].map((c,i)=>[c,Number(code[i])]));}
export function applyLetterDialect(ch,glyph,style,m){
 const choice=letterDialect(style)[ch];if(!choice)return glyph;
 const {height:H,width:W,short:a,long:b,unit:u,ratio}=m,v=W/ratio,k=W/ratio**2;
 const L=(...ps)=>ps.map(([x,y])=>({x,y})),P=(points,smooth=true)=>({points,smooth});
 const oval=(cy=H/2,rx=W/2,ry=H/2)=>Array.from({length:33},(_,i)=>{const t=-Math.PI/2+i/32*Math.PI*2;return{x:W/2+Math.cos(t)*rx,y:cy+Math.sin(t)*ry};});
 const forms={
  P:{
   1:[P(L([0,H],[0,0],[W-u,0],[W,u],[W,a-u],[W-u,a],[0,a]),false)],
   2:[P(L([0,H],[0,0])),P(L([0,0],[W-u,0],[W,a/ratio],[W-u,a],[0,a]))],
   3:[P(L([0,H+u],[0,0],[W/2,-u],[W,a/2],[v,a],[0,a],[0,H+u]))],
   4:[P(L([0,H+a],[0,a],[k,a-u],[W,b],[k,H],[0,H]))]
  },
  R:{
   1:[P(L([0,H],[0,0],[W-u,0],[W,u],[W,a-u],[v,a],[0,a]),false),P(L([k,a],[W,H]),false)],
   2:[P(L([0,H],[0,0],[W/2,0],[W,a/2],[v,a],[0,a],[k,b],[W+u,H]))],
   3:[P(L([0,H],[0,0],[W,a/ratio],[k,a],[0,a],[W+v,H+u]),false)],
   4:[P(L([0,H],[0,a],[u,a+u],[0,b],[k,a-u],[W,a],[W+u,b],[v,b+u],[W,H]))]
  },
  O:{
   1:[P(L([W/2,0],[W,a],[W-u,H-u],[k,H],[0,b],[u,u],[W/2,0]),false)],
   2:[P(L([W/2,0],[W-u,u],[W,a],[W,b],[W-u,H-u],[W/2,H],[u,H-u],[0,b],[0,a],[u,u],[W/2,0]))],
   3:[P(oval(a+b/2,W/2,b/2))],
   4:[P(L([v,u],[W,b],[v,H],[u,H-u],[0,b],[u,u],[v,u],[W/2,a]))]
  },
  T:{
   1:[P(L([-u,0],[W+u,0]),false),P(L([W/2,0],[W/2,H]),false)],
   2:[P(L([-u,u],[W+v,-u],[v,0],[v,H],[W+u,H-u]))],
   3:[P(L([W/2,-u],[W/2,H]),false),P(L([-u,a/ratio],[W+u,-u]),false)],
   4:[P(L([v,0],[k,H-u],[v,H],[W,H-u])),P(L([-u,a],[W,a-u]))]
  },
  I:{
   1:[P(L([k,0],[k,H]),false)],
   2:[P(L([0,0],[v,0],[v/2,0],[v/2,H],[0,H],[v,H]),false)],
   3:[P(L([-u,u],[k,0],[k,H],[W,H-u]),false)],
   4:[P(L([u,a],[u,H],[v,H-u])),P(L([u,a-v],[u,a-v-u/2]))]
  },
  N:{
   1:[P(L([0,H],[0,0],[W,H],[W,0]),false)],
   2:[P(L([0,H],[u,0],[W-u,H],[W,0]))],
   3:[P(L([0,H],[0,0],[u,0],[W-u,H],[W,H],[W,0]),false)],
   4:[P(L([0,H],[0,a],[u,a+u],[v,a],[W,b],[W,H]))]
  },
  E:{
   1:[P(L([W,0],[0,0],[0,H],[W,H]),false),P(L([0,b],[v,b]),false)],
   2:[P(L([W,u],[v,0],[u,u],[0,a],[v,a],[0,b],[u,H],[W,H-u]))],
   3:[P(L([W,0],[u,0],[0,u],[0,H-u],[u,H],[W,H]),false),P(L([0,b],[W-u,a]),false)],
   4:[P(L([0,b],[v,a],[W,a+u],[v,b],[0,b],[u,H],[W/2,H],[W,H-u]))]
  },
  A:{
   1:[P(L([0,H],[W/2,0],[W,H]),false),P(L([k/2,b],[W-k/2,b]),false)],
   2:[P(oval(a+b/2,W/2,b/2)),P(L([W,a],[W,H],[W+u,H-u]))],
   3:[P(L([0,H],[0,a],[W/2,0],[W,a],[W,H]),false),P(L([0,b],[W,b]),false)],
   4:[P(L([0,H],[k,u],[v,0],[W,H],[W-u,b],[0,b]))]
  },
  H:{
   1:[P(L([0,0],[0,H]),false),P(L([W,0],[W,H]),false),P(L([0,b],[W,b]),false)],
   2:[P(L([0,H],[0,u],[v,0],[k,u],[0,b],[v,a],[k,a],[W,b],[W,H]))],
   3:[P(L([0,H],[0,0]),false),P(L([W,H],[W,0]),false),P(L([0,a],[W,a]),false)],
   4:[P(L([0,H],[0,0],[0,b],[v,a],[k,a],[W,b],[W,H]))]
  },
  C:{
   1:[P(L([W,u],[W-u,0],[u,0],[0,u],[0,H-u],[u,H],[W-u,H],[W,H-u]),false)],
   2:[P(L([W,a/ratio],[v,0],[u,u],[0,H/2],[u,H-u],[v,H],[W,H-a/ratio]))],
   3:[P(L([W,a+u],[k,a],[u,a+u],[0,b],[u,H-u],[k,H],[W+u,H-u]))],
   4:[P(L([W,a],[v,a-u],[u,a],[0,b],[u,H],[v,H],[W,H-u]))]
  }
 };
 return forms[ch]?.[choice]?{...glyph,strokes:forms[ch][choice]}:glyph;
}

export function shapeWicket(ch,glyph,style,m){
 const {height:H,width:W,short:a,long:b,unit:u,ratio}=m,v=W/ratio;
 const L=(...ps)=>ps.map(([x,y])=>({x,y})),P=(points,smooth=true)=>({points,smooth});
 let strokes=glyph.strokes;
 if(!/[A-Z]/.test(ch))return glyph;
 if(style.id==='kadism'&&/[PRTIKNLHM]/.test(ch)){
  // A return loop belongs to the existing stem, not a repeated extra glyph.
  const first=strokes[0],tail=first.points.slice(1);
  strokes=[P([...L([0,H],[u,0],[W/2,-a/ratio],[v,-a/ratio],[W/2,u]),...tail]),...strokes.slice(1)];
 }else if(style.id==='karma'&&/[PRTIKNF]/.test(ch)){
  const first=strokes[0];strokes=[P([...L([-u,a],[0,-u],[v,0]),...first.points],false),...strokes.slice(1)];
 }else if(style.id==='enem'&&/[HLTMN]/.test(ch)){
  const first=strokes[0];strokes=[P([...L([-u,b],[0,u],[W/2,-a/ratio],[v,u]),...first.points]),...strokes.slice(1)];
 }else if(style.id==='yorker'&&/[PRTIKL]/.test(ch)){
  const first=strokes[0];strokes=[P([...L([0,H],[0,0],[v,-u],[W/2,u]),...first.points.slice(1)]),...strokes.slice(1)];
 }else if(style.id==='rame'&&/[PRTM]/.test(ch)){
  const first=strokes[0];strokes=[P([...L([-u,b],[0,0],[W/2,-u],[v,0]),...first.points]),...strokes.slice(1)];
 }
 return {...glyph,strokes};
}
