// Runtime bridge for the current prebuilt live gallery bundle. The native browser
// is also in visitor-v2/chat-v2.mjs for the next full build.
// Only modifies chat buttons, never the WebGL scene or dialogue engine.
const GROUPS=[
 ['Around the gallery',[
  'What is this place?','How was the tower built?', "How does a day's art become a floor?",
  'What determines the rooms?','How are paintings hung?','How do drawings become sculptures?',
  'What is the gramophone?','What are the screens?']],
 ['Conversations',[
  'What have you noticed?', "What's your favourite?",'Where did you come from?',
  'How is this connected to Fibonacci?','Is the golden ratio enough?']],
 ['Golden ratio & nature',[
  'What is the golden ratio?','Who discovered phi?','What is Fibonacci?',
  'What is the golden angle?','Is phi everywhere in nature?','Is the nautilus shell golden?',
  'What is a golden rectangle?','Who was Roger Penrose?']],
 ['Art history & evidence',[
  'Does the Parthenon use phi?','Did Leonardo use phi?','Which artists used phi?',
  'What is the Modulor?','Is the golden ratio more beautiful?','Do faces follow phi?',
  'Is phi used in music?']],
 ['Art, code & chance',[
  'What is the rule of thirds?','How does composition work?','Tell me about Kandinsky',
  'What is generative art?','Tell me about Sol LeWitt','How is chance used in art?','Is this art?']],
 ['Materials & sculpture',[
  'What is action painting?','What is watercolour?','What is oil paint?',
  'What is relief sculpture?']]
];
const PAGE_SIZE=4;
const active=new WeakMap();
const styles=document.createElement('style');
styles.id='visitor-chat-topic-browser-css';
styles.textContent=`
.visitor-chat.visitor-chat-v2{max-height:min(86dvh,780px);bottom:max(18px,env(safe-area-inset-bottom,0px))}
.visitor-chat-v2 .visitor-chat-log{flex:1 1 auto;min-height:78px}
.visitor-chat-v2 .visitor-chat-head,.visitor-chat-v2 .visitor-chat-form{flex-shrink:0}
.visitor-chat-v2 .visitor-chat-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start;max-height:none;min-height:0;overflow:visible;flex:0 0 auto;padding:12px 15px}
.visitor-chat-v2 .visitor-chat-chips button{width:100%;min-width:0;min-height:44px;white-space:normal;overflow-wrap:anywhere;font:12px/1.35 Arial,Helvetica,sans-serif;padding:9px 10px}
.visitor-chat-v2 .visitor-chat-chips .visitor-chat-more{font-weight:600;border-color:#8d8066}
.visitor-chat-v2 .visitor-chat-browser-heading{grid-column:1/-1;color:#46564b;font:12px/1.3 Arial,Helvetica,sans-serif;padding:2px 0}
@media(max-width:620px){.visitor-chat.visitor-chat-v2{max-height:min(90dvh,740px);bottom:max(12px,env(safe-area-inset-bottom,0px))}.visitor-chat-v2 .visitor-chat-chips{gap:7px;padding:10px 12px}.visitor-chat-v2 .visitor-chat-log{min-height:78px}}
@media(max-height:570px){.visitor-chat.visitor-chat-v2{max-height:calc(100dvh - 14px);bottom:7px}.visitor-chat-v2 .visitor-chat-chips{gap:5px;padding:7px 10px}.visitor-chat-v2 .visitor-chat-chips button{min-height:36px;padding:6px 8px;font-size:11px}.visitor-chat-v2 .visitor-chat-log{min-height:56px}}
`;
document.head.append(styles);

function button(chips,label,handler,extra=''){
 const b=document.createElement('button');
 b.type='button';b.textContent=label;b.dataset.topicBrowserItem='1';
 if(extra)b.className=extra;
 b.addEventListener('click',handler);chips.append(b);
 return b;
}
function restore(chips){
 const previous=active.get(chips)?.previous||[];
 active.delete(chips);delete chips.dataset.topicBrowser;
 chips.replaceChildren(...previous);
 chips.querySelector('button:last-child')?.focus({preventScroll:true});
}
function show(chips,group=-1,page=0){
 const current=active.get(chips);if(!current)return;
 active.set(chips,{...current,group,page});
 chips.dataset.topicBrowser='1';chips.replaceChildren();
 if(group<0){
  for(let i=0;i<GROUPS.length;i++){
   const [label,topics]=GROUPS[i];
   button(chips,label+' ('+topics.length+')',()=>show(chips,i));
  }
  button(chips,'← Back to chat',()=>restore(chips),'visitor-chat-more');
 }else{
  const [label,topics]=GROUPS[group];
  const heading=document.createElement('span');
  heading.className='visitor-chat-browser-heading';heading.dataset.topicBrowserItem='1';
  heading.textContent=label;chips.append(heading);
  for(const question of topics.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)){
   button(chips,question,()=>{
    active.delete(chips);delete chips.dataset.topicBrowser;
    const form=chips.closest('.visitor-chat-v2')?.querySelector('.visitor-chat-form');
    const input=form?.querySelector('input');
    if(!form||!input)return;
    input.value=/\?\s*$/.test(question)?question:question+'?';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    input.focus({preventScroll:true});
   });
  }
  button(chips,'← Categories',()=>show(chips),'visitor-chat-more');
  if(topics.length>PAGE_SIZE)
   button(chips,'More in this category →',()=>show(chips,group,(page+1)%Math.ceil(topics.length/PAGE_SIZE)),'visitor-chat-more');
 }
 chips.querySelector('button')?.focus({preventScroll:true});
}
function ensure(chips){
 const panel=chips.closest('.visitor-chat-v2');
 if(!panel||panel.hidden)return;
 if(chips.dataset.topicBrowser==='1'){
  if(chips.querySelector('[data-topic-browser-item]'))return;
  // The core chat replaced the menu after a new answer.
  delete chips.dataset.topicBrowser;active.delete(chips);
 }
 // The source-built UI already has native discovery; don't duplicate its chip.
 if([...chips.querySelectorAll('button')].some(b=>b.textContent.trim()==='More topics…'))return;
 const more=document.createElement('button');
 more.type='button';more.className='visitor-chat-more';more.textContent='More topics…';
 more.addEventListener('click',()=>{
  active.set(chips,{previous:[...chips.children],group:-1,page:0});
  show(chips);
 });
 chips.append(more);
}
function ensureAll(){
 document.querySelectorAll('.visitor-chat-v2 .visitor-chat-chips').forEach(ensure);
}
new MutationObserver(changes=>{
 if(changes.some(m=>m.target.classList?.contains('visitor-chat-chips')||
  [...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.visitor-chat-v2')||n.querySelector?.('.visitor-chat-v2')))))
  ensureAll();
}).observe(document.body,{childList:true,subtree:true});
ensureAll();
