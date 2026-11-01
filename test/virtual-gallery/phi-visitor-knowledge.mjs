// General φ and art knowledge for the rule-based gallery visitors.
// Each topic: keys (words or phrases that identify it), answers (asked again
// or "tell me more" moves to the next), optional per-temperament take for
// contested claims, and optional next (what "tell me more" leads to after the
// last answer). Contested or popular-myth claims are flagged as such: the
// tower keeps the φ question open, so visitors shouldn't oversell it.

export const KNOWLEDGE=[
 // ---------------------------------------------------------------- φ itself
 {id:'phi-definition',
  keys:['what is phi','what is φ','whats phi','whats φ','what is the golden ratio','whats the golden ratio','what is the golden section',
   'what is the golden mean','define phi','define the golden ratio','what does phi mean','1.618','square root of 5','calculate phi','how do you calculate'],
  answers:[
   'φ, the golden ratio, is about 1.618. Split a line so that the whole is to the longer part as the longer part is to the shorter, and that ratio is φ. Exactly, it’s (1 + √5) ÷ 2.',
   'It has odd habits. Square it and you get φ + 1, about 2.618. Take its reciprocal and you get φ − 1, about 0.618. That 0.618 point is the “golden section” — the tower cuts its floor plans there.',
   'It can be written as 1 + 1/(1 + 1/(1 + …)) forever. Because that fraction is all ones, φ is the number hardest to approximate with simple fractions — mathematicians sometimes call it the “most irrational” number.'],
  next:'golden-angle'},
 {id:'phi-history',
  keys:['history of phi','history of the golden ratio','who discovered phi','who discovered the golden ratio','who invented the golden ratio','euclid','pacioli','divine proportion','divina proportione','extreme and mean ratio','why is it called phi','why is it called the golden ratio','why φ','why phi','phidias'],
  answers:[
   'The earliest clear definition is in Euclid’s Elements, around 300 BC, where it’s called dividing a line in “extreme and mean ratio”. It was geometry for him, not aesthetics.',
   'In 1509 Luca Pacioli published De Divina Proportione — “the divine proportion” — with polyhedra drawn by Leonardo da Vinci. The name “golden section” came much later, in 1830s Germany.',
   'The letter φ was suggested in the early 1900s, usually credited to the American mathematician Mark Barr, as a nod to the sculptor Phidias. Whether Phidias ever used it is another matter.'],
  next:'parthenon'},
 {id:'fibonacci',
  keys:['fibonacci','1 1 2 3 5 8','sequence','liber abaci','rabbits','leonardo of pisa'],
  answers:[
   'The Fibonacci sequence goes 1, 1, 2, 3, 5, 8, 13, 21… — each number is the sum of the two before. Divide one term by the one before and the answers home in on φ: 8/5 is 1.6, 21/13 is about 1.615.',
   'Leonardo of Pisa, later nicknamed Fibonacci, brought it to European readers in Liber Abaci in 1202, with a puzzle about breeding rabbits. Indian scholars had found the same numbers centuries earlier while counting rhythms in poetry.',
   'The artist Mario Merz put Fibonacci numbers into his work in neon from the 1970s — he liked them as a picture of growth. That’s one of the few places in art where the use is beyond doubt.'],
  next:'nature'},
 {id:'golden-angle',
  keys:['golden angle','137.5','137','phyllotaxis','sunflower','seed head','pine cone','pinecone','daisy','leaves'],
  answers:[
   'The golden angle is about 137.5° — a full turn divided by φ squared. Many plants place each new seed or leaf about that far round from the last.',
   'Because φ is so hard to approximate with fractions, seeds at the golden angle never line up in neat rows. They pack evenly, and the spirals you count in a sunflower head are often neighbouring Fibonacci numbers, like 34 and 55.',
   'The Golden Trajectories system here borrows the golden angle for its curved paths — that’s where φ is most literally “in” some of these drawings.'],
  next:'nature'},
 {id:'nature',
  keys:['nature','natural','everywhere','galaxy','galaxies','hurricane','dna','universe','plants','in nature'],
  answers:[
   'Some of it is real — leaf and seed arrangements really do follow the golden angle, for good mechanical reasons. But a lot of “φ is everywhere” is people drawing spirals over photos until something fits.',
   'Galaxies, hurricanes and DNA come up a lot. Their spirals are roughly logarithmic, but they don’t have a single growth ratio, let alone φ. Lots of things are near 1.6 if you measure loosely enough.'],
  take:{enthusiast:'I still find the plants astonishing, though.',sceptic:'Which is partly why I doubt it here.',regular:'I try to separate the real cases from the posters.'},
  next:'nautilus'},
 {id:'nautilus',
  keys:['nautilus','shell','shells','snail','golden spiral','logarithmic spiral'],
  answers:[
   'A golden spiral grows by φ every quarter-turn. The nautilus shell is the famous example — but when people actually measure nautilus shells, the spiral isn’t golden. It is a logarithmic spiral, just a different one.',
   'The spiral you see on posters is drawn by fitting quarter-circles inside shrinking golden rectangles. It approximates a true golden spiral, but it’s a construction, not something taken from a shell.'],
  next:'golden-rectangle'},
 {id:'golden-rectangle',
  keys:['golden rectangle','golden rectangles','rectangle ratio','cut off a square','pentagon','pentagram'],
  answers:[
   'A golden rectangle has sides in the ratio φ. Cut a square off one end and what’s left is another golden rectangle — you can keep going forever. The canvas here isn’t one, mind: it’s 7:5.',
   'φ turns up exactly in a regular pentagon: the diagonal is φ times the side. Draw all five diagonals and the star you get, the pentagram, is full of golden ratios. That’s probably how the Greeks first met it.'],
  next:'phi-history'},
 {id:'penrose-history',
  keys:['roger penrose','who was penrose','who is penrose','aperiodic','quasicrystal','quasicrystals','shechtman','kite','dart','rhombs','rhombus','non repeating','never repeats'],
  answers:[
   'Roger Penrose found his tilings in the 1970s. Two shapes — here a fat and a thin rhombus — cover a floor forever without the pattern ever repeating.',
   'In a large Penrose tiling the fat rhombs outnumber the thin ones by φ to 1. And in 1982 Dan Shechtman found crystals with the same kind of order — quasicrystals. He won the Nobel Prize in Chemistry for it in 2011.'],
  next:'golden-rectangle'},
 // ---------------------------------------------------------- φ in art/myth
 {id:'parthenon',
  keys:['parthenon','greek','greeks','ancient greece','temple','pyramid','pyramids','egypt','great pyramid'],
  answers:[
   'The Parthenon is the classic claim. But golden rectangles only fit it if you choose where to draw them — top of the steps or bottom, with the roof or without. There’s no ancient evidence the builders used φ.',
   'The Great Pyramid gets the same treatment. Some of its proportions are close to φ, but they’re also close to other neat ratios, and nothing written down from Egypt mentions it.'],
  take:{enthusiast:'I’d still like it to be true.',sceptic:'The tower is more honest about its φ than most famous buildings.',regular:'It’s a good test, though: if you look for φ, you tend to find it.'},
  next:'leonardo'},
 {id:'leonardo',
  keys:['leonardo','da vinci','mona lisa','vitruvian','last supper','renaissance'],
  answers:[
   'Leonardo did draw the illustrations for Pacioli’s book on the divine proportion. But there’s no solid evidence he composed the Mona Lisa or anything else with φ — the golden rectangles in diagrams of it are drawn on afterwards.',
   'The Vitruvian Man is about the proportions Vitruvius described — whole-number fractions of the body — not φ. It gets drafted into the golden-ratio story a lot.'],
  next:'modern-artists'},
 {id:'modern-artists',
  keys:['dali','dalí','sacrament','seurat','mondrian','section dor','section d’or','cubist','cubism','juan gris','villon','modern art','who used phi','who used the golden ratio','which artists'],
  answers:[
   'Salvador Dalí’s The Sacrament of the Last Supper, 1955, is one of the clear cases: the canvas is close to a golden rectangle, and a huge dodecahedron — a φ-filled solid — hangs over the table.',
   'In 1912 a group of Cubists in Paris exhibited as the Section d’Or — “golden section”. The name was a nod to mathematical order; how much they actually measured with it is debated.',
   'Mondrian and Seurat are often said to have used φ, but neither left good evidence. Mondrian placed his lines by eye, and repainted them until they felt right.'],
  next:'le-corbusier'},
 {id:'le-corbusier',
  keys:['le corbusier','corbusier','modulor','modernist architecture'],
  answers:[
   'Le Corbusier did use φ, openly. His Modulor system, published in 1948, scaled a standing man’s height through golden ratios into a set of building measurements.',
   'He used the Modulor in buildings like the Unité d’Habitation in Marseille. It’s a nice parallel to this tower — a building planned by golden divisions — except his started from the human body.'],
  next:'preference'},
 {id:'preference',
  keys:['beautiful','beauty','prefer','preference','pleasing','attractive','do people like','fechner','fechner','science','proof','prove','is it more beautiful'],
  answers:[
   'Gustav Fechner tested it in the 1870s: shown a set of rectangles, people picked ones near the golden ratio more than others. That result made φ famous as “the beautiful proportion”.',
   'Later studies are much less tidy. Preferences vary with person, context and method, and often land somewhere between about 1.4 and 1.8, not on φ itself. There’s no settled proof that φ is more beautiful.'],
  take:{enthusiast:'I’d say these rooms are a better experiment than a card of rectangles.',sceptic:'Which is why I think the material matters more here.',regular:'That’s the question the whole place is asking.'},
  next:'faces'},
 {id:'faces',
  keys:['face','faces','body','human body','golden mask','navel','height'],
  answers:[
   'You’ll see claims that beautiful faces fit a golden mask, or that height divided by navel height is φ. Real measurements vary a lot from person to person, and the beauty claims haven’t held up well in studies.'],
  next:'preference'},
 {id:'phi-music',
  keys:['is phi used in music','phi used in music','debussy','bartok','bartók','mozart','music theory','composers','composer','howat','lendvai','la mer'],
  answers:[
   'Roy Howat’s book Debussy in Proportion argues that Debussy placed key moments at golden-section points — it’s one of the better-argued cases. Ernő Lendvai made similar claims about Bartók.',
   'Mozart is the disputed one: some of his sonata movements split near 0.618, but many don’t, and it may be coincidence. That’s why the gramophone just marks the points and lets you listen.'],
  next:'preference'},
 {id:'thirds',
  keys:['rule of thirds','thirds','photography','golden section composition'],
  answers:[
   'The rule of thirds puts key things a third of the way across, at 0.333. The golden section puts them at 0.382 or 0.618. They’re close, which is one reason it’s hard to prove which one people respond to.',
   'The phrase “rule of thirds” dates from 1797, from an engraver called John Thomas Smith, writing about landscape painting. Photographers adopted it later.'],
  next:'composition'},
 // ------------------------------------------------------------------- art
 {id:'composition',
  keys:['composition','balance','focal point','negative space','visual weight','arnheim','good composition'],
  answers:[
   'Composition is how the parts of a picture are arranged — where the eye goes first, what balances what, how much empty space there is. Rudolf Arnheim wrote about it as a pull of visual forces in Art and Visual Perception, 1954.',
   'Empty space counts as much as the marks. Some studies here are sparse on purpose — the gaps are part of the composition, not missing content.'],
  next:'kandinsky'},
 {id:'kandinsky',
  keys:['kandinsky','klee','bauhaus','point and line','pedagogical','hilma','af klint','malevich','black square','abstract','abstraction'],
  answers:[
   'Kandinsky and Klee both taught at the Bauhaus and tried to write down rules for abstract composition — Kandinsky’s Point and Line to Plane came out in 1926. They’re early attempts at what the engines here do in code.',
   'Abstract painting has several starting points: Hilma af Klint was painting abstract works by 1906, Kandinsky around 1910, and Malevich showed his Black Square in 1915.'],
  next:'generative'},
 {id:'generative',
  keys:['generative art','computer art','algorithmic art','vera molnar','molnar','molnár','georg nees','frieder nake','michael noll','manfred mohr','harold cohen','aaron','cybernetic serendipity','plotter art','first computer'],
  answers:[
   'Computer-generated art was first exhibited in 1965 — Georg Nees in Stuttgart and A. Michael Noll in New York, with Frieder Nake soon after. They drew with plotters, much like the plotter export here.',
   'Vera Molnár worked with simple rules and small amounts of randomness from the late 1950s — first by hand, then by computer from 1968. Her squares slowly going out of order are very close in spirit to these drawings.',
   'In 1968 the ICA in London held Cybernetic Serendipity, the first big show of computer art. And Harold Cohen spent decades from the 1970s teaching his program AARON to draw.'],
  next:'instructions'},
 {id:'instructions',
  keys:['sol lewitt','lewitt','instructions','instruction','conceptual art','conceptual','yoko ono','grapefruit','fluxus','audience','participation'],
  answers:[
   'Sol LeWitt’s wall drawings are sets of written instructions that other people carry out — he argued the idea itself works like a machine that makes the art. That’s close to a seed and an engine.',
   'Yoko Ono’s Grapefruit, 1964, is a book of instruction pieces the reader completes, often only in their head. The editor here works a bit like that: you finish the piece by moving the sliders.'],
  next:'chance'},
 {id:'chance',
  keys:['chance','random','randomness','dada','arp','john cage','cage','accident','luck'],
  answers:[
   'Artists were using chance long before computers. Jean Arp made collages around 1916 by letting paper fall, and John Cage composed with coin tosses from the I Ching.',
   'Here the chance is seeded — it looks random, but the same seed gives the same drawing every time. So it’s chance you can repeat, which Arp couldn’t do.'],
  next:'generative'},
 {id:'action-painting',
  keys:['what is action painting','pollock','jackson pollock','de kooning','rosenberg','drip','drips','abstract expressionism','expressionism'],
  answers:[
   'The term “action painting” was coined by the critic Harold Rosenberg in 1952 — the canvas as an arena to act in. Jackson Pollock’s poured and dripped paintings are the best-known examples.',
   'The action material here imitates pours, pools and splashes. A fair question is whether gesture still means anything when a rule makes it — that’s part of what the project is testing.'],
  next:'chance'},
 {id:'watercolour-history',
  keys:['history of watercolour','what is watercolour','what is watercolor','turner','durer','dürer','transparent','gouache'],
  answers:[
   'Watercolour is pigment in a water-soluble binder. It’s transparent, so the white comes from the paper — you plan the lights rather than painting them on.',
   'Dürer made remarkable watercolours around 1500, and J. M. W. Turner pushed the medium hard in the early 1800s. The simulated version here focuses on drying edges and paper grain.'],
  next:'oil-history'},
 {id:'oil-history',
  keys:['history of oil','what is oil paint','van eyck','eyck','glaze','glazing','impasto','linseed'],
  answers:[
   'Oil paint is pigment ground in a drying oil, usually linseed. It dries slowly, so painters can blend, layer and glaze. Jan van Eyck didn’t invent it, but he showed what it could do in the 1430s.',
   'Thick, textured oil paint is called impasto — you can see the brush in it. The oil material here simulates bristle texture, a bit like that.'],
  next:'watercolour-history'},
 {id:'relief',
  keys:['what is a relief','relief sculpture','bas relief','bas-relief','what is relief'],
  answers:[
   'A relief is sculpture that projects from a background rather than standing free — think of the friezes on old buildings, or a coin. The portrait studies here are turned into layered reliefs on plinths.'],
  next:'composition'},
 {id:'is-it-art',
  keys:['is this art','is it art','real art','can a computer make art','can computers make art','who is the artist','is the computer the artist'],
  answers:[
   'People argued about that in 1965 too. Someone wrote the rules, chose the seeds, tuned it by eye and curated what’s shown — so there’s a lot of human choice in it, just not in each mark.'],
  take:{enthusiast:'I think so, obviously, or I wouldn’t keep coming back.',sceptic:'I’m still deciding. Ask me again upstairs.',regular:'I think the editor is where it becomes yours, too.'},
  next:'instructions'}
 // --------------------------------------------- building the daily tower
 {id:'tower-build',
  keys:['how was the tower built','how is the tower built','how do you build the tower','tower construction','how was this building designed','tower design','tower architecture','building geometry'],
  answers:[
   'The tower is generated rather than modelled floor by floor. Each edition begins with a floor plan divided at golden-section points. Smaller spaces are merged into walkable rooms and linked with doors and passages.',
   'The same lift shaft passes through the floors. Walls, frames, glass walkways and lighting are assembled around each plan. It is a working 3D gallery, not just a stack of pictures.',
   'There is a reception at ground level and one dated exhibition floor above it for each published daily collection. Older editions remain in the archive as the tower grows upwards.'],
  next:'daily-to-floor'},
 {id:'daily-to-floor',
  keys:['how does a days art become a floor','how does a day become a floor','how does each day become an exhibition','how are daily images turned into a gallery','how do images become a floor','from images to gallery','images into the tower','daily collection into a floor','how does a daily edition work'],
  answers:[
   'First the day’s studies are generated with reproducible seeds, composition engines and simulated materials, then published in that date’s archive. The gallery reads the edition’s study information rather than inventing a different set of works.',
   'Next, the dated floor plan creates rooms. A curation pass groups works into rooms using properties such as material, engine or palette, and assigns wall positions. Room names describe the grouping actually chosen.',
   'Finally, paintings are hung in frames and selected portrait works become layered sculptures. Image loading and room construction happen in stages, especially while the lift travels. The result is a new visitable floor linked to that day’s 2D edition.'],
  next:'curation-process'},
 {id:'curation-process',
  keys:['what determines the rooms','how do you curate the rooms','how are rooms curated','how are works grouped','how is a floor curated','room curation','room grouping','why are these artworks together','how are the rooms named'],
  answers:[
   'Rooms are not assigned by a single strict rule. The curation process looks for useful relationships among the day’s works — material, composition engine, palette or combinations — and groups them within the available floor plan.',
   'A room can mix materials when the works make more sense together by another quality. Its hanging sign should describe the common thread honestly instead of labelling a mixed room “watercolour”.',
   'Curation is separate from drawing generation. φ helps shape the architecture and refine placement, but a coherent room also needs clear sightlines, sensible groupings and room to look at the work.'],
  next:'hanging-process'},
 {id:'hanging-process',
  keys:['how are paintings hung','how are paintings placed','how do you choose wall positions','how is artwork positioned','hanging process','hanging rules','placement on walls','sightlines','why on this wall'],
  answers:[
   'The hanging system chooses real stretches of usable gallery wall. Doors, corners, other artworks and visitor routes constrain where a piece can go.',
   'A refinement pass nudges placements towards golden-section positions where there is space, then checks clearances again. φ influences the hanging without being allowed to block a doorway or crowd the room.'],
  next:'sculpture-translation'},
 {id:'sculpture-translation',
  keys:['how do drawings become sculptures','how are sculptures made','how do portraits become sculptures','why do images become sculptures','sculpture translation','portrait to sculpture','2d to 3d'],
  answers:[
   'Only a subset of portrait-format studies becomes sculpture. Their underlying composition is translated into layered 3D forms rather than simply wrapping the image around a box.',
   'Different composition families lend themselves to different forms: orbital arrangements, ribbons following trajectories and strata built from divisions. The sculpture keeps a relationship to its source drawing but becomes something you can walk around.'],
  next:'relief'},
];

// Where "tell me more" goes after the tower's own answers (intents in
// phi-visitor-chat.mjs), so a conversation can move from the room to the ideas.
export const FOLLOW_ON={
 phi:'preference',how:'generative',project:'instructions',tiles:'penrose-history',music:'phi-music',
 material:'action-painting',canvas:'golden-rectangle',remix:'instructions',ai:'is-it-art',
 room:'curation-process',tower:'tower-build',daily:'daily-to-floor',light:'le-corbusier',sculpture:'sculpture-translation',export:'generative'
};

// Same normalisation as the chat's words(): accents and apostrophes dropped.
export const normalise=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[‘’']/g,'').replace(/[^a-z0-9φ.\s-]/g,' ').trim().split(/\s+/).filter(Boolean).join(' ');
for(const topic of KNOWLEDGE)topic.keys=[...new Set(topic.keys.map(normalise))];
const byId=new Map(KNOWLEDGE.map(topic=>[topic.id,topic]));
export const knowledgeTopic=id=>byId.get(id)||null;

/** Best-matching topic for a question, how strongly it matched, and the keys hit. */
export function matchKnowledge(line){
 let best=null;
 for(const topic of KNOWLEDGE){
  const hits=topic.keys.filter(key=>(' '+line+' ').includes(' '+key+' '));
  const score=hits.reduce((n,key)=>n+(key.includes(' ')?2.5:2),0);
  if(score&&(!best||score>best.score))best={topic,score,hits};
 }
 return best;
}

/** An unused answer from a topic — preferring one that mentions what was
 *  asked about ("Dürer", "Molnár") — or null once the topic is exhausted. */
export function knowledgeAnswer(topic,persona,seen={},hits=[]){
 const used=seen[topic.id]||[];
 const open=topic.answers.map((text,index)=>({text,index})).filter(a=>!used.includes(a.index));
 if(!open.length)return null;
 const named=hits.flatMap(key=>key.split(' ')).filter(w=>w.length>3);
 const pick=open.find(a=>named.some(w=>normalise(a.text).includes(w)))||open[0];
 let text=pick.text;
 if(open.length===1&&topic.take?.[persona])text+=' '+topic.take[persona];
 return {text,seen:{...seen,[topic.id]:[...used,pick.index]}};
}
