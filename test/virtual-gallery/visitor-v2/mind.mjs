// Frames and scripts. Each visitor is a frame: slots with defaults (name,
// temperament, where they came from, what they've said), filled from their
// seed and the floor. A "gallery visit" script gives them a stage — arriving,
// looking, comparing, leaving — that moves on as you talk.
// The session is shared by every visitor on this page load, so what you tell
// one visitor, others can hear about. Nothing is stored or sent anywhere.

export const session={userName:null,views:[],interests:{},met:[]};
export function resetSession(){session.userName=null;session.views=[];session.interests={};session.met=[];}

const NAMES=['Ines','Tomasz','Ruth','Kwame','Marguerite','Dev','Saoirse','Hugo','Amara','Felix','Noor','Bea'];
const TYPES=['enthusiast','sceptic','regular'];
export function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}

export function visitorFrame({date,roomIndex,visitorIndex,floor,floorDates=[]}){
 const seed=hash((date||'reception')+':'+roomIndex+':'+visitorIndex);
 const earlier=floorDates.filter(d=>d<date);
 // Default slot: a visitor who came up from an earlier floor, if there is one.
 const from=earlier.length&&floor>1?1+(seed>>>5)%Math.max(1,floor-1):null;
 return {seed,name:NAMES[(seed>>>3)%NAMES.length],persona:TYPES[seed%3],from,
  said:new Set(),stage:'arriving'};
}
// Script stages advance with the conversation.
export const STAGES=['arriving','looking','comparing','leaving'];
export function stageFor(turns){return turns<2?'arriving':turns<6?'looking':turns<16?'comparing':'leaving';}

const STOP=new Set(['tired','hungry','happy','sad','busy','late','early','bored','exhausted','angry','cold','hot','sick','ready','later','not','just','looking','here','fine','ok','okay','good','sure','a','an','the','so','very','really','new','back','sorry','afraid','glad','going','still','also','only','visiting','interested','confused','lost']);
/** "I'm Sam" / "my name is Sam" / "call me Sam" → "Sam". */
export function readName(question){
 const q=String(question).replace(/[\u2018\u2019]/g,"'").trim();
 // Require the introduction to be the complete message: 'call me later'
 // and sentences such as 'I'm tired today' are not names.
 const m=q.match(/^(?:my name is|my name's|call me|i am|i'm|im)\s+([A-Za-z][a-z'-]{1,19})[.!?\s]*$/i);
 if(!m)return null;
 const name=m[1];
 if(STOP.has(name.toLowerCase()))return null;
 return name[0].toUpperCase()+name.slice(1).toLowerCase();
}

export function rememberView(view,told){
 session.views=session.views.filter(v=>v.view!==view);
 session.views.push({view,told});
}
export function noteInterest(topic){if(topic)session.interests[topic]=(session.interests[topic]||0)+1;}
export function topInterest(){return Object.entries(session.interests).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;}
