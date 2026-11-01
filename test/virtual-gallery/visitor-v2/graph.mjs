// Semantic network: concepts, people and the tower's own systems joined by
// labelled links. Visitors answer "how is X connected to Y?" by searching for
// a path, and explain that path link by link. Claims that are disputed or
// myths carry that in the relation itself, so a path can't launder a myth.
import {normalise} from '../phi-visitor-knowledge.mjs';

// [id, label, type, aliases]
const NODES=[
 ['phi','φ (the golden ratio)','concept',['phi','φ','golden ratio','golden mean','golden section','divine proportion','1.618']],
 ['golden-angle','the golden angle','concept',['golden angle','137.5']],
 ['fibonacci','the Fibonacci sequence','concept',['fibonacci','fibonacci sequence','fibonacci numbers']],
 ['golden-rectangle','the golden rectangle','concept',['golden rectangle']],
 ['golden-spiral','the golden spiral','concept',['golden spiral','logarithmic spiral']],
 ['pentagon','the regular pentagon','concept',['pentagon','pentagram']],
 ['penrose','Penrose tiling','concept',['penrose','penrose tiling','penrose tiles','tiles','tiling']],
 ['quasicrystals','quasicrystals','concept',['quasicrystal','quasicrystals']],
 ['sunflower','sunflower seed heads','nature',['sunflower','sunflowers','seed head','pine cone','pinecone']],
 ['nautilus','the nautilus shell','nature',['nautilus','shell']],
 ['parthenon','the Parthenon','building',['parthenon']],
 ['mona-lisa','the Mona Lisa','artwork',['mona lisa']],
 ['rule-of-thirds','the rule of thirds','concept',['rule of thirds','thirds']],
 ['euclid','Euclid','person',['euclid']],
 ['pacioli','Luca Pacioli','person',['pacioli','luca pacioli']],
 ['leonardo','Leonardo da Vinci','person',['leonardo','da vinci','leonardo da vinci']],
 ['le-corbusier','Le Corbusier','person',['le corbusier','corbusier','modulor']],
 ['dali','Salvador Dalí','person',['dali','salvador dali']],
 ['section-dor','the Section d’Or group','movement',['section dor','section d or']],
 ['merz','Mario Merz','person',['merz','mario merz']],
 ['debussy','Claude Debussy','person',['debussy']],
 ['bartok','Béla Bartók','person',['bartok','bela bartok']],
 ['fechner','Gustav Fechner','person',['fechner']],
 ['penrose-roger','Roger Penrose','person',['roger penrose']],
 ['molnar','Vera Molnár','person',['molnar','vera molnar']],
 ['nees','Georg Nees','person',['nees','georg nees']],
 ['nake','Frieder Nake','person',['nake','frieder nake']],
 ['noll','A. Michael Noll','person',['noll','michael noll']],
 ['cohen','Harold Cohen','person',['harold cohen','aaron']],
 ['lewitt','Sol LeWitt','person',['lewitt','sol lewitt']],
 ['ono','Yoko Ono','person',['yoko ono','ono']],
 ['arp','Jean Arp','person',['arp','jean arp']],
 ['cage','John Cage','person',['john cage','cage']],
 ['pollock','Jackson Pollock','person',['pollock','jackson pollock']],
 ['rosenberg','Harold Rosenberg','person',['rosenberg','harold rosenberg']],
 ['kandinsky','Wassily Kandinsky','person',['kandinsky']],
 ['klee','Paul Klee','person',['klee','paul klee']],
 ['bauhaus','the Bauhaus','movement',['bauhaus']],
 ['durer','Albrecht Dürer','person',['durer','albrecht durer']],
 ['turner','J. M. W. Turner','person',['turner']],
 ['van-eyck','Jan van Eyck','person',['van eyck','eyck']],
 ['generative-art','generative art','movement',['generative art','computer art','algorithmic art','generative']],
 ['instruction-art','instruction art','movement',['instruction art','instructions','conceptual art']],
 ['chance','chance in art','concept',['chance','randomness','random']],
 ['action-painting','action painting','movement',['action painting']],
 ['watercolour','watercolour','medium',['watercolour','watercolor']],
 ['oil','oil paint','medium',['oil paint','oil painting','oil']],
 ['seeds','seeds','system',['seed','seeds']],
 ['editor','the editor','system',['editor','sliders','slider']],
 ['proportion-piece','PROPORTION PIECE','system',['proportion piece','this project','the project','algo art']],
 ['tower','the tower','system',['tower','this building','floor plan','floor plans']],
 ['gramophone','the gramophone','system',['gramophone']],
 ['lighting','the room lighting','system',['lighting','lights']],
 // Composition systems and materials (ids match the editor's settings).
 ['engine:field','Orbital Studies','engine',['orbital studies']],
 ['engine:spiral','Golden Trajectories','engine',['golden trajectories']],
 ['engine:rects','Recursive Divisions','engine',['recursive divisions']],
 ['engine:burst','Radiant Systems','engine',['radiant systems']],
 ['engine:network','Connected Fields','engine',['connected fields']],
 ['engine:organic','Growth Systems','engine',['growth systems']],
 ['engine:geometric','Constructed Forms','engine',['constructed forms']],
 ['engine:scribble','Automatic Marks','engine',['automatic marks']],
 ['material:marker','the marker material','material',['marker']],
 ['material:tissue','the tissue-and-graphite material','material',['tissue','graphite']],
 ['material:watercolour','the watercolour material','material',['watercolour material']],
 ['material:oil','the oil material','material',['oil material']],
 ['material:action','the action-painting material','material',['action material','action']]
];
// [from, relation, to]. Relations read as "from <relation> to".
const EDGES=[
 ['golden-angle','is a full turn divided by the square of','phi'],
 ['fibonacci','has neighbouring ratios that approach','phi'],
 ['golden-rectangle','has its sides in the ratio','phi'],
 ['golden-spiral','grows by a factor of','phi'],
 ['golden-spiral','can be drawn inside','golden-rectangle'],
 ['pentagon','has diagonals and sides in the ratio','phi'],
 ['penrose','has fat and thin tiles in the ratio','phi'],
 ['penrose-roger','discovered','penrose'],
 ['quasicrystals','have the same kind of non-repeating order as','penrose'],
 ['sunflower','places its seeds at','golden-angle'],
 ['sunflower','often shows spiral counts from','fibonacci'],
 ['nautilus','is often wrongly said to follow','golden-spiral'],
 ['parthenon','is claimed, without good evidence, to use','phi'],
 ['mona-lisa','is claimed, without good evidence, to use','phi'],
 ['leonardo','painted','mona-lisa'],
 ['rule-of-thirds','sits close to the golden section of','phi'],
 ['euclid','first defined','phi'],
 ['pacioli','wrote “On the Divine Proportion” about','phi'],
 ['leonardo','illustrated the book by','pacioli'],
 ['le-corbusier','built his Modulor system on','phi'],
 ['dali','openly used','phi'],
 ['section-dor','was named after','phi'],
 ['merz','put neon numbers from','fibonacci'],
 ['debussy','is argued by Roy Howat to have used','phi'],
 ['bartok','is argued by Ernő Lendvai to have used','phi'],
 ['fechner','tested people’s preference for','golden-rectangle'],
 ['molnar','was a pioneer of','generative-art'],
 ['nees','first exhibited','generative-art'],
 ['noll','first exhibited','generative-art'],
 ['nake','was an early maker of','generative-art'],
 ['cohen','spent decades on','generative-art'],
 ['lewitt','made','instruction-art'],
 ['ono','made','instruction-art'],
 ['generative-art','is a close relative of','instruction-art'],
 ['arp','made collages with','chance'],
 ['cage','composed with','chance'],
 ['seeds','make repeatable','chance'],
 ['rosenberg','coined the term','action-painting'],
 ['pollock','made','action-painting'],
 ['kandinsky','taught at','bauhaus'],
 ['klee','taught at','bauhaus'],
 ['durer','painted in','watercolour'],
 ['turner','painted in','watercolour'],
 ['van-eyck','showed what could be done with','oil'],
 ['proportion-piece','is a work of','generative-art'],
 ['proportion-piece','asks how far a composition can be governed by','phi'],
 ['editor','lets you finish a piece, like','instruction-art'],
 ['proportion-piece','makes every drawing from','seeds'],
 ['tower','cuts its floor plans at the golden section of','phi'],
 ['tower','has floors inlaid with','penrose'],
 ['gramophone','marks golden-section points of','phi'],
 ['tower','keeps, in reception,','gramophone'],
 ['gramophone','plays recordings including','debussy'],
 ['lighting','is placed by golden divisions of','phi'],
 ['engine:spiral','follows curves influenced by','golden-angle'],
 ['engine:field','balances marks around focal points, shaped by','phi'],
 ['engine:rects','splits the canvas into unequal rectangles shaped by','phi'],
 ['engine:burst','sends marks outwards, spaced by','phi'],
 ['engine:network','connects marks into networks, spaced by','phi'],
 ['engine:organic','branches and grows in scale, guided by','phi'],
 ['engine:geometric','sizes and places shapes using','phi'],
 ['engine:scribble','makes loose strokes, grouped by','phi'],
 ['material:watercolour','imitates','watercolour'],
 ['material:oil','imitates','oil'],
 ['material:action','imitates','action-painting'],
 ['proportion-piece','has the composition system','engine:field'],
 ['proportion-piece','has the composition system','engine:spiral'],
 ['proportion-piece','has the composition system','engine:rects'],
 ['proportion-piece','has the composition system','engine:burst'],
 ['proportion-piece','has the composition system','engine:network'],
 ['proportion-piece','has the composition system','engine:organic'],
 ['proportion-piece','has the composition system','engine:geometric'],
 ['proportion-piece','has the composition system','engine:scribble'],
 ['proportion-piece','has the material','material:marker'],
 ['proportion-piece','has the material','material:tissue'],
 ['proportion-piece','has the material','material:watercolour'],
 ['proportion-piece','has the material','material:oil'],
 ['proportion-piece','has the material','material:action']
];
// Legacy gallery data calls tissue-and-graphite "watercolor".
const MATERIAL_ID={watercolor:'tissue'};

export function buildGraph(works=[]){
 const nodes=new Map(),edges=[];
 for(const [id,label,type,aliases] of NODES)nodes.set(id,{id,label,type,aliases:aliases.map(normalise)});
 for(const [from,rel,to] of EDGES)edges.push({from,rel,to});
 // The room's works join the network through their system and material.
 for(const w of works){
  const id='work:'+(w.studyId||w.title);
  nodes.set(id,{id,label:'“'+w.title+'”',type:'work',aliases:[],work:w});
  if(nodes.has('engine:'+w.engine))edges.push({from:id,rel:'belongs to',to:'engine:'+w.engine});
  const m=MATERIAL_ID[w.material]||w.material;
  if(nodes.has('material:'+m))edges.push({from:id,rel:'is rendered in',to:'material:'+m});
 }
 const adjacent=new Map();
 for(const e of edges){
  for(const [a,b] of [[e.from,e.to],[e.to,e.from]]){
   if(!adjacent.has(a))adjacent.set(a,[]);
   adjacent.get(a).push(e);
  }
 }
 return {nodes,edges,adjacent};
}

/** Graph nodes named in a normalised line, longest alias first. */
export function findNodes(graph,line){
 const found=[];let rest=' '+line+' ';
 const all=[...graph.nodes.values()].flatMap(n=>n.aliases.map(a=>[a,n])).sort((a,b)=>b[0].length-a[0].length);
 for(const [alias,node] of all){
  if(alias&&rest.includes(' '+alias+' ')&&!found.includes(node)){
   found.push(node);rest=rest.replace(' '+alias+' ','  ');
  }
 }
 return found;
}

/** Shortest path (breadth first) between two nodes, as a list of edges. */
export function findPath(graph,from,to,maxSteps=5){
 if(from===to)return [];
 const previous=new Map([[from,null]]),queue=[from];
 while(queue.length){
  const at=queue.shift();
  const depth=countBack(previous,at);
  if(depth>=maxSteps)continue;
  for(const e of graph.adjacent.get(at)||[]){
   const other=e.from===at?e.to:e.from;
   if(previous.has(other))continue;
   previous.set(other,{at,e});
   if(other===to){
    const path=[];let node=to;
    while(previous.get(node)){const step=previous.get(node);path.unshift(step.e);node=step.at;}
    return path;
   }
   queue.push(other);
  }
 }
 return null;
}
function countBack(previous,node){let n=0;while(previous.get(node)){node=previous.get(node).at;n++;}return n;}

export function edgeSentence(graph,e){
 const a=graph.nodes.get(e.from).label,b=graph.nodes.get(e.to).label;
 const s=a+' '+e.rel+' '+b+'.';
 return s[0].toUpperCase()+s.slice(1);
}
export function neighbours(graph,id){
 return (graph.adjacent.get(id)||[]).map(e=>edgeSentence(graph,e));
}
