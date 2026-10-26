// A shared nib movement replaces the recipient's first eligible hairline,
// without deleting its main letter anatomy.
export const BROADNIB_REVISION='nib-clusters-01';
const pairs=new Set(['PR','RO','OP','PI','IE','OR','ON','TI']);
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296};
export function composeBroadNib(plan,{seed='V3',mode='restrained'}={}){
 const letters=plan.letters.map(l=>({...l,variant:'plain',shapes:[...l.glyph.shapes]})),shared=[];
 if(mode!=='none')for(let i=1;i<letters.length;i++){
  const a=letters[i-1],b=letters[i],pair=a.ch+b.ch;
  if(b.index!==a.index+1||!pairs.has(pair))continue;
  const n=hash(seed+'|nib|'+i);
  if(n>(mode==='expressive'?.93:.63))continue;
  const x0=a.x+56,x1=b.x+24,dx=x1-x0;
  if(dx<6||dx>83)continue;
  // Pen continues from one letter into the next with a high shoulder and nib-led return.
  const d=`M ${x0.toFixed(2)} 62 C ${(x0+dx*.22).toFixed(2)} ${(35-n*9).toFixed(2)} ${(x1-dx*.25).toFixed(2)} ${(86+n*5).toFixed(2)} ${x1.toFixed(2)} 53`;
  const replace=b.shapes.findIndex(s=>s.kind==='hairline'&&s.role!=='structure');
  // Do not remove any protected shape; connected variant is authored by
  // changing the pen's entry trajectory and retaining essential structure.
  if(replace>=0)b.shapes.splice(replace,1);
  b.variant='nib-receiver';a.variant='nib-sender';
  shared.push({kind:'stroke',role:'primary',d,width:5.8,from:a.index,to:b.index,pair,tool:'angled-nib',structural:true});
 }
 return {word:plan.word,letters,shared,connectors:[],mode,revision:BROADNIB_REVISION};
}
