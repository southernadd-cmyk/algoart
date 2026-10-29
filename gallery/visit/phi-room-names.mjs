// Titles are selected only when every work meets the stated condition.
const materials={
 marker:['The Drawn Line','A Line in Motion','Intervals of Ink'],
 tissue:['Layers and Traces','Paper upon Paper','Between the Layers'],
 watercolour:['Water and Colour','Where Colour Settles','The Shape of a Wash'],
 oil:['Colour with Weight','A Painted Surface','The Weight of Colour'],
 action:['Gesture and Drift','Traces of Motion','The Reach of a Gesture']
};
const engines={
 field:['Around a Centre','Fields of Attraction','An Orbital Order'],
 trajectory:['Paths through Space','Lines of Travel','A Measured Journey'],
 rects:['Edges in Balance','An Order of Edges','Placed in Relation'],
 burst:['From the Centre','Radiating Outward','A Common Centre'],
 growth:['Branching Orders','Patterns of Growth','An Unfolding Order'],
 network:['Points of Contact','Connected Fields','Between the Points'],
 automatic:['Marks in Motion','Following the Hand','An Open Gesture'],
 recursive:['Within the Frame','Divisions within Divisions','A Smaller Whole'],
 organic:['An Unfolding Form','Forms in Relation','A Living Geometry'],
 construct:['Edges in Balance','Built from Parts','An Assembly of Forms']
};
const palettes={
 earth:['An Earthward Turn','Colours of Earth','An Earthen Register'],
 warm:['A Warmer Register','Towards Warmth','Warmth in Relation'],
 cold:['A Cooler Register','Towards Coolness','Cool Intervals'],
 mono:['Within One Register','Light and Dark','Tonal Conversations'],
 golden:['A Golden Register','In Golden Colour','Golden Intervals'],
 pastel:['A Softer Register','Pale Intervals','Soft Colour Relations'],
 neon:['An Electric Register','Electric Intervals','High Colour'],
 spectrum:['Across the Spectrum','A Colour Continuum','Many Colours'],
 cmyk:['Four Colour Conversations','A Printed Register','Colour in Combination'],
 marker:['A Marker Palette','Colours in Conversation','A Colour Register']
};
const pairs={
 'oil|watercolour':['Wash and Weight','Between Wash and Paint','Two Ways with Colour'],
 'marker|tissue':['Line and Layer','Ink beside Paper','Marks and Layers'],
 'marker|watercolour':['Line and Wash','Ink beside Water','Drawn and Washed'],
 'oil|tissue':['Paper and Paint','Layers with Weight','Two Kinds of Surface']
};
const aliases={trajectories:'trajectory',rect:'rects'};
function entries(room,dimension){
 const total=room.studyIds?.length||0;
 const values=room.composition?.[dimension];
 if(values?.length&&values.every(v=>v.value&&v.count>0)&&values.reduce((n,v)=>n+v.count,0)===total)return values;
 if(!room.composition&&room.theme?.dimension===dimension&&room.theme.count===total&&total)return [{value:room.theme.value,count:total}];
 return [];
}
export function nameExhibitionRooms(rooms){
 const used=new Set(),result=new Map();
 for(const room of [...rooms].sort((a,b)=>a.room-b.room)){
  if(!room.studyIds?.length)continue;
  const choices=[];
  const add=(titles,dimension,values)=>{for(const title of titles||[])choices.push({title,dimension,values});};
  // Specific shared structure takes precedence over a general material name.
  for(const [dimension,bank] of [['engine',engines],['material',materials],['palette',palettes]]){
   const values=entries(room,dimension);
   if(values.length===1)add(bank[aliases[values[0].value]||values[0].value],dimension,values.map(v=>v.value));
  }
  const materialValues=entries(room,'material').map(v=>v.value).sort();
  if(materialValues.length===2)add(pairs[materialValues.join('|')],'material',materialValues);
  // General titles describe an encounter, without inventing a visual property.
  add(['In Conversation','Points of Difference','A Shared Space','Side by Side','Ways of Making','A Meeting of Forms','Common Ground','Across the Room','In Good Company','Separate Voices','A Gathering','Together in View'],null,[]);
  let choice=choices.find(c=>!used.has(c.title));
  if(!choice)choice={title:'Studies in Relation '+(room.room+1),dimension:null,values:[]};
  used.add(choice.title);
  result.set(room.room,choice);
 }
 return result;
}
