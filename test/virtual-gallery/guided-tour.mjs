// TEST TOWER ONLY. Integrated at build time; never imported by the live gallery bundle.
// Tours follow the floor's authored collision surfaces, doorways and artwork placements.
const STEP = .65;
const NEIGHBOURS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const clamp = (x,lo,hi) => Math.max(lo,Math.min(hi,x));
const shortestTurn = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const lerpAngle = (a,b,maxStep) => a+clamp(shortestTurn(a,b),-maxStep,maxStep);

// Build route bounds in world space; every dated floor is rotated by the
// golden angle, so local axis-aligned bounds cannot be used for grid search.
export function tourWorldBounds(phi){
  const r=phi.floor.root;
  const corners=[[r.x,r.z],[r.x+r.w,r.z],[r.x,r.z+r.h],[r.x+r.w,r.z+r.h]]
    .map(([x,z])=>phi.world?phi.world.toWorld(x,z):{x,z});
  const xs=corners.map(p=>p.x),zs=corners.map(p=>p.z);
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minZ=Math.min(...zs),maxZ=Math.max(...zs);
  return {x:minX,z:minZ,w:maxX-minX,h:maxZ-minZ};
}

export function clearTourLine(a,b,walkable,spacing=.2){
  const d=distance(a,b);
  const n=Math.max(1,Math.ceil(d/spacing));
  for(let k=0;k<=n;k++){
    const t=k/n;
    if(!walkable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;
  }
  return true;
}

// Bounded, deterministic grid search. Only invoked on clicking Tour or Next,
// never on startup or in the animation loop.
export function findTourPath(start,end,walkable,root){
  if(!walkable(start.x,start.z)||!walkable(end.x,end.z))return null;
  if(clearTourLine(start,end,walkable))return [start,end];
  const margin=3.5,step=STEP;
  const x0=root.x-margin,z0=root.z-margin;
  const nx=Math.ceil((root.w+2*margin)/step)+1;
  const nz=Math.ceil((root.h+2*margin)/step)+1;
  if(nx*nz>24000)return null;
  const point=(ix,iz)=>({x:x0+ix*step,z:z0+iz*step});
  const id=(ix,iz)=>iz*nx+ix;
  const valid=(ix,iz)=>ix>=0&&iz>=0&&ix<nx&&iz<nz;
  const nearest=(p)=>{
    let best=null,bestScore=Infinity;
    const ix=Math.round((p.x-x0)/step),iz=Math.round((p.z-z0)/step);
    for(let radius=0;radius<=6;radius++){
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
        const xx=ix+dx,zz=iz+dz;
        if(!valid(xx,zz))continue;
        const candidate=point(xx,zz),score=distance(candidate,p);
        if(score<bestScore&&walkable(candidate.x,candidate.z)&&clearTourLine(candidate,p,walkable)){
          best={ix:xx,iz:zz};bestScore=score;
        }
      }
      if(best)return best;
    }
    return null;
  };
  const source=nearest(start),target=nearest(end);
  if(!source||!target)return null;
  const sourceId=id(source.ix,source.iz),targetId=id(target.ix,target.iz);
  const visited=new Uint8Array(nx*nz),prev=new Int32Array(nx*nz).fill(-1);
  const queue=new Int32Array(nx*nz);
  let head=0,tail=0;queue[tail++]=sourceId;visited[sourceId]=1;
  while(head<tail){
    const current=queue[head++];
    if(current===targetId)break;
    const ix=current%nx,iz=Math.floor(current/nx),p=point(ix,iz);
    for(const [dx,dz] of NEIGHBOURS){
      const xx=ix+dx,zz=iz+dz;
      if(!valid(xx,zz))continue;
      const next=id(xx,zz);
      if(visited[next])continue;
      const q=point(xx,zz);
      // Check the actual swept segment: prevents diagonal corner cutting.
      if(!walkable(q.x,q.z)||!clearTourLine(p,q,walkable))continue;
      visited[next]=1;prev[next]=current;queue[tail++]=next;
    }
  }
  if(!visited[targetId])return null;
  const chain=[];
  for(let p=targetId;p>=0;p=prev[p]){
    chain.push(point(p%nx,Math.floor(p/nx)));
    if(p===sourceId)break;
  }
  chain.reverse();
  const raw=[start,...chain,end];
  const smooth=[raw[0]];
  for(let from=0;from<raw.length-1;){
    let last=from+1;
    for(let to=raw.length-1;to>from+1;to--){
      if(clearTourLine(raw[from],raw[to],walkable)){last=to;break;}
    }
    smooth.push(raw[last]);from=last;
  }
  return smooth;
}

export function createGuidedTour(getContext){
  const top=document.querySelector('.topbar .top-actions');
  const trigger=document.createElement('button');
  trigger.id='testGuidedTour';
  trigger.type='button';
  trigger.textContent='Guided tour';
  trigger.title='Tour the artworks on the current exhibition floor';
  top.insertBefore(trigger,top.firstChild);
  const panel=document.createElement('section');
  panel.id='testTourPanel';
  panel.hidden=true;
  panel.setAttribute('aria-label','Guided exhibition tour');
  panel.innerHTML='<div class="test-tour-heading"><strong>guided tour</strong><button type="button" data-tour="close" aria-label="Leave tour">×</button></div>'+
    '<p id="testTourTitle" aria-live="polite">Your personal gallery walk</p>'+
    '<p id="testTourMeta">Walking route · current exhibition</p>'+
    '<div class="test-tour-controls">'+
    '<button type="button" data-tour="back" aria-label="Previous artwork">◀</button>'+
    '<button type="button" data-tour="toggle">Start tour</button>'+
    '<button type="button" data-tour="next" aria-label="Next artwork">▶</button>'+
    '</div><div class="test-tour-progress"><span id="testTourProgress"></span></div>'+
    '<p class="test-tour-help">Pause to look around. Use the lift for another floor.</p>';
  document.body.appendChild(panel);
  const title=panel.querySelector('#testTourTitle');
  const meta=panel.querySelector('#testTourMeta');
  const toggle=panel.querySelector('[data-tour=toggle]');
  const progress=panel.querySelector('#testTourProgress');
  let mode='idle',stops=[],index=0,leg=[],at=1,hold=0,floorKey='';
  let cached=null;
  const ctx=()=>getContext();
  const state=()=>ctx();

  function isSafe(x,z,c){
    return c.phi.canWalk(x,z)&&c.clearObstacles(x,z);
  }
  function stopForArt(art,c,from){
    const p=art.position,n=art.normal;
    const candidates=[];
    if(n){
      const tangent={x:-n.z,z:n.x};
      for(const radius of [2.15,2.65,1.65,3.05]){
        for(const side of [0,-.55,.55,-1.0,1.0]){
          const v={x:p.x+n.x*radius+tangent.x*side,z:p.z+n.z*radius+tangent.z*side};
          if(isSafe(v.x,v.z,c))candidates.push(v);
        }
      }
    }else{
      for(const radius of [2.2,2.7,1.7])for(let i=0;i<12;i++){
        const angle=i*Math.PI/6;
        const v={x:p.x+Math.cos(angle)*radius,z:p.z+Math.sin(angle)*radius};
        if(isSafe(v.x,v.z,c))candidates.push(v);
      }
    }
    candidates.sort((a,b)=>distance(a,from)-distance(b,from));
    return candidates.slice(0,5);
  }
  function planStops(c){
    if(!c.phi||!c.artExhibits.length)return [];
    const remaining=c.artExhibits.filter(a=>a.study&&!a.study.credits);
    const selected=[],root=tourWorldBounds(c.phi);
    const safe=(x,z)=>isSafe(x,z,c);
    let from={x:c.rig.position.x,z:c.rig.position.z};
    while(remaining.length&&selected.length<16){
      remaining.sort((a,b)=>distance(a.position,from)-distance(b.position,from));
      let chosen=null;
      // Try multiple viewing positions; the geometric shortest choice may
      // be separated by a wall despite looking near in Euclidean distance.
      for(const art of remaining.slice(0,6)){
        for(const spot of stopForArt(art,c,from).slice(0,3)){
          const path=findTourPath(from,spot,safe,root);
          if(path){
            const length=path.slice(1).reduce((sum,p,i)=>sum+distance(p,path[i]),0);
            if(!chosen||length<chosen.length)chosen={art,spot,path,length};
          }
        }
        if(chosen&&chosen.length<3.5)break;
      }
      if(!chosen)break;
      selected.push(chosen);
      remaining.splice(remaining.indexOf(chosen.art),1);
      from=chosen.spot;
    }
    return selected;
  }
  function label(){
    const c=state();
    trigger.disabled=!c.phi||!c.entered||c.xr||c.liftTravelling||c.date===c.reception;
    trigger.title=c.date===c.reception?'Take the lift to a daily exhibition to start a tour':'Guided tour of this floor';
    if(mode==='idle'){
      title.textContent='Tour this exhibition floor';
      meta.textContent='A guided walk between its paintings and sculptures';
      toggle.textContent='Start tour';
      progress.style.width='0%';
    }else if(mode==='complete'){
      title.textContent='End of this floor’s tour';
      meta.textContent='Continue exploring or take the lift to another day';
      toggle.textContent='Restart tour';
      progress.style.width='100%';
    }else{
      const art=stops[index]?.art;
      title.textContent=art?.study?.title||'Moving to the next artwork';
      const medium=art?.study?.material?.type?.replace(/[-_]/g,' ')||'Artwork';
      meta.textContent=(index+1)+' / '+stops.length+' · '+medium+' · '+(mode==='paused'?'Paused':'Tour in progress');
      toggle.textContent=mode==='playing'?'Pause':'Resume';
      progress.style.width=(((index+1)/Math.max(1,stops.length))*100)+'%';
    }
    panel.querySelector('[data-tour=back]').disabled=index<=0||mode==='idle';
    panel.querySelector('[data-tour=next]').disabled=mode==='idle'||mode==='complete'||index>=stops.length-1;
  }
  function routeToCurrent(){
    const c=state(),here={x:c.rig.position.x,z:c.rig.position.z};
    if(!stops[index]||!c.phi)return false;
    const target=stops[index].spot;
    const safe=(x,z)=>isSafe(x,z,c);
    const path=findTourPath(here,target,safe,tourWorldBounds(c.phi));
    if(!path)return false;
    leg=path;at=1;hold=0;mode='playing';
    return true;
  }
  function begin(){
    const c=state();
    if(!c.entered||c.xr||c.liftTravelling||!c.phi||c.date===c.reception){
      title.textContent='Select a dated gallery floor using the lift';
      panel.hidden=false;return;
    }
    floorKey=c.date;
    stops=planStops(c);index=0;
    if(!stops.length){
      title.textContent='No safe route found on this floor';
      meta.textContent='Explore freely while we refine the tour planner';
      panel.hidden=false;mode='idle';return;
    }
    c.cancelInspect();
    c.clearInputs();
    if(!routeToCurrent()){
      mode='idle';title.textContent='Cannot reach the first stop safely';
    }
    label();
  }
  function pause(){
    if(mode==='playing'){
      mode='paused';label();
    }
  }
  function stop(){
    mode='idle';stops=[];leg=[];at=1;hold=0;floorKey='';
    panel.hidden=true;label();
  }
  function next(delta){
    if(mode==='idle'||mode==='complete')return;
    index=clamp(index+delta,0,stops.length-1);
    if(!routeToCurrent()){
      pause();title.textContent='The next stop is blocked';
      return;
    }
    state().cancelInspect();label();
  }
  function play(){
    if(mode==='idle'||mode==='complete'){begin();return;}
    if(mode==='playing'){pause();return;}
    if(mode==='paused'){
      if(!routeToCurrent()){title.textContent='Route blocked — try another position';return;}
      state().clearInputs();label();
    }
  }
  trigger.addEventListener('click',()=>{
    const c=state();
    if(c.date===c.reception||!c.entered){panel.hidden=false;label();return;}
    panel.hidden=false;if(mode==='idle')begin();else label();
    document.exitPointerLock?.();
  });
  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-tour]');
    if(!button)return;
    const action=button.dataset.tour;
    if(action==='close')stop();
    if(action==='toggle')play();
    if(action==='back')next(-1);
    if(action==='next')next(1);
  });
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'&&!panel.hidden&&mode==='playing')pause();
  });

  function update(dt){
    const c=state();
    if(c.date!==floorKey&&mode!=='idle'){stop();return false;}
    if(mode!=='playing')return false;
    if(!c.entered||!c.phi||c.liftTravelling||c.xr){pause();return false;}
    const art=stops[index]?.art;
    if(!art){mode='complete';label();return false;}
    const loc={x:c.rig.position.x,z:c.rig.position.z};
    if(at<leg.length){
      const goal=leg[at],d=distance(loc,goal);
      if(d<=.09){at++;return true;}
      const advance=Math.min(d,1.45*dt);
      const nx=loc.x+(goal.x-loc.x)/d*advance,nz=loc.z+(goal.z-loc.z)/d*advance;
      if(!isSafe(nx,nz,c)){pause();title.textContent='Route interrupted by an obstacle';return false;}
      const desiredYaw=Math.atan2(-(goal.x-loc.x),-(goal.z-loc.z));
      c.setView(nx,nz,lerpAngle(c.yaw(),desiredYaw,1.95*dt),
        c.pitch()+(0-c.pitch())*Math.min(1,dt*2));
      return true;
    }
    const targetYaw=Math.atan2(-(art.position.x-loc.x),-(art.position.z-loc.z));
    const targetPitch=clamp(Math.atan2(art.position.y-(c.rig.position.y+1.68),distance(art.position,loc)),-.45,.45);
    c.setView(loc.x,loc.z,lerpAngle(c.yaw(),targetYaw,1.6*dt),
      c.pitch()+clamp(targetPitch-c.pitch(),-dt*.8,dt*.8));
    hold+=dt;
    if(hold>=5.5){
      if(index>=stops.length-1){mode='complete';label();}
      else next(1);
    }
    return true;
  }
  function drawMap({ctx:Xctx,X,Z,phi}){
    if((mode==='idle'||mode==='complete')||!leg.length||!phi.world)return;
    Xctx.save();
    Xctx.strokeStyle='#bb5e2d';Xctx.lineWidth=2.8;
    Xctx.setLineDash([5,3]);
    Xctx.beginPath();
    leg.forEach((p,i)=>{
      const local=phi.world.toLocal(p.x,p.z);
      if(i===0)Xctx.moveTo(X(local.x),Z(local.z));
      else Xctx.lineTo(X(local.x),Z(local.z));
    });
    Xctx.stroke();Xctx.setLineDash([]);
    const target=stops[index]?.spot;
    if(target){const p=phi.world.toLocal(target.x,target.z);
      Xctx.beginPath();Xctx.arc(X(p.x),Z(p.z),4.2,0,Math.PI*2);
      Xctx.fillStyle='#bb5e2d';Xctx.fill();
    }
    Xctx.restore();
  }
  return {
    update,drawMap,stop,pause,isRunning:()=>mode==='playing',
    onFloorChanging:stop,refresh:label
  };
}
