// A tiny Tracery-style grammar: #symbol# expands to a seeded choice, {name}
// fills from context. Visitors vary their phrasing without new facts.
export function rng(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function expand(grammar,symbol,random,ctx={},depth=0){
 const options=grammar[symbol];
 if(!options||depth>8)return '';
 const choice=options[Math.floor(random()*options.length)];
 return choice.replace(/#(\w+)#/g,(_,s)=>expand(grammar,s,random,ctx,depth+1))
  .replace(/\{(\w+)\}/g,(_,v)=>ctx[v]??'');
}
export const GRAMMAR={
 notice:['Have you noticed that {fact}?','Something I spotted: {fact}.','Look — {fact}.','Funny thing about this room: {fact}.'],
 noticeAgain:['And another thing: {fact}.','Also, {fact}.','Oh, and {fact}.'],
 opinionLead:['If you ask me, {opinion}.','Honestly, {opinion}.','For what it’s worth, {opinion}.'],
 back:['Oh — you’re back.','Hello again.','Back for more?'],
 gotName:['Nice to meet you, {name}.','Hello, {name}.','Good to meet you, {name}.'],
 gossip:['{other} told me you think {view}.','I was chatting to {other} — apparently you think {view}.','{other} says you reckon {view}.'],
 overhearLead:['As you walk up, {a} is saying to {b}:','You catch {a} in the middle of telling {b}:'],
 agree:['Exactly what I thought.','I agree with you there.','Yes — I said the same on the way in.'],
 disagree:['I don’t buy it.','Really? I see it the other way round.','Hmm. I’m not so sure.'],
 ack:['Mm, I hadn’t noticed.','Huh. So it does.','I’d spotted that too.'],
 shrug:['Maybe. I haven’t decided.','Could be. Ask me tomorrow.','Some days I’d agree.'],
 arrival:['I came up from floor {from}.','I’ve just come up from floor {from}.','I started on floor {from} and worked my way up.']
};
