// Artist-specific construction layer. Original procedural strokes, not traced signatures.
// This layer runs after family glyphs and dialects, before page transforms.
const path=(...pairs)=>({points:pairs.map(([x,y])=>({x,y})),smooth:true});
const angular=(...pairs)=>({points:pairs.map(([x,y])=>({x,y})),smooth:false});
const oval=(x,y,rx,ry,start=-Math.PI/2,end=1.5*Math.PI)=>path(...Array.from({length:25},(_,i)=>{const t=start+(end-start)*i/24;return [x+rx*Math.cos(t),y+ry*Math.sin(t)]}));
const mapPoints=(strokes,fn)=>strokes.map((stroke,i)=>({...stroke,points:stroke.points.map((p,j)=>fn(p,i,j,stroke.points.length))}));
function guess(ch,m,glyph){
  // Connected rounded skeleton: open ovals, hooked stems, rising exits.
  const {height:H,width:W,short:a,long:b,unit:u}=m;
  const v=W/m.ratio, top=a-u, base=H, mid=a+b*.48;
  const bowl=()=>oval(W*.5,mid,W*.48,b*.46,-Math.PI*.85,Math.PI*1.05);
  const forms={
    M:[path([0,base],[0,top],[v,top-u],[v,mid],[v,top],[W*.72,top-u],[W*.72,mid],[W*.72,top],[W,top+u],[W,base])],
    U:[path([0,top],[0,mid],[u,base-u],[v,base],[W-u,base-u],[W,mid],[W,top],[W+u,top-u])],
    S:[path([W,top+u],[v,top-u],[u,top+u],[0,mid-u],[v,mid],[W-u,mid+u],[W,base-u],[v,base+u],[0,base])],
    H:[path([0,base],[0,top-u],[u,top-2*u],[v,top-u],[0,mid],[v,mid-u],[W-u,mid],[W,base],[W+u,base-u])],
    R:[path([0,base],[0,top],[v,top-u],[W,top+u],[v,mid],[0,mid]),path([v,mid],[W+u,base-u])],
    O:[bowl(),path([W,mid],[W+u,base-u])],
    G:[bowl(),path([W,mid],[W,base+u],[v,base+2*u])],
    E:[path([W,mid],[0,mid],[u,top],[v,top-u],[W,top+u],[v,mid],[0,base-u],[v,base],[W,base-u])],
    A:[bowl(),path([W,mid],[W,base],[W+u,base-u])]
  };
  return forms[ch]?{...glyph,strokes:forms[ch]}:glyph;
}
const gestures={
  // Each of these has a contrasting pen habit, applied to every letter.
  faust:{stem:.22,terminal:.8,elastic:.11,cut:0},
  sicoer:{stem:.08,terminal:.46,elastic:.24,cut:0},
  gorey:{stem:0,terminal:.1,elastic:.31,cut:0},
  kadism:{stem:.38,terminal:.25,elastic:.05,cut:0},
  revok:{stem:.04,terminal:0,elastic:0,cut:1},
  zephyr:{stem:0,terminal:0,elastic:0,cut:1},
  guess:{stem:.04,terminal:.65,elastic:.29,cut:0},
  veefer:{stem:.04,terminal:.52,elastic:.2,cut:0}
};
export function applyArtistGesture(ch,glyph,style,m){
  if(style.id==='guess')return guess(ch,m,glyph);
  const recipe=gestures[style.id];if(!recipe)return glyph;
  const {height:H,width:W,unit:u}=m;
  let strokes=mapPoints(glyph.strokes,(p,i,j,n)=>({
    x:p.x+recipe.elastic*u*Math.sin(p.y/H*Math.PI*2+i*1.4),
    y:p.y-(p.x/W)*recipe.stem*u*Math.sin(j/Math.max(1,n-1)*Math.PI)
  }));
  if(recipe.terminal&&strokes.length){
    // Move a real pen exit. This is part of the final movement, never a
    // detached decorative stroke applied to the word after writing.
    const last=strokes.at(-1),ps=last.points;
    if(ps.length>=2){
      const p=ps.at(-1),q=ps.at(-2),dx=p.x-q.x,dy=p.y-q.y,len=Math.hypot(dx,dy)||1;
      const tail={x:p.x+(dx/len)*u*recipe.terminal+u*recipe.terminal*.3,
                  y:p.y+(dy/len)*u*recipe.terminal-u*recipe.terminal*.5};
      strokes=[...strokes.slice(0,-1),{...last,points:[...ps,tail]}];
    }
  }
  if(recipe.cut)strokes=strokes.map(s=>({...s,smooth:false}));
  return {...glyph,strokes};
}
