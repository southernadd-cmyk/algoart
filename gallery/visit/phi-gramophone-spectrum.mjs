// Test-only φ spectrum for the existing gramophone recordings.
// This is frequency-selective equalisation, NOT pitch retuning.
// Always starts dry. The source is rerouted only after the visitor opts in.
export const GOLDEN_RATIO=(1+Math.sqrt(5))/2;

export function phiSpectrumBands({base=220,count=6,phi=GOLDEN_RATIO}={}){
 if(!Number.isFinite(base)||base<=0||!Number.isInteger(count)||count<1||count>12)
   throw new RangeError('Invalid φ spectrum parameters');
 return Array.from({length:count},(_,i)=>({
   frequency:base*phi**i,
   gain:i%2===0?9:-7,
   Q:2.8
 }));
}

export function createGramophonePhiSpectrum(audio,{
  Context=globalThis.AudioContext||globalThis.webkitAudioContext,
  bands=phiSpectrumBands()
}={}){
 let context=null,source=null,dry=null,wet=null,output=null,enabled=false,disposed=false;
 let filters=[];
 function initialise(){
   if(context)return;
   if(!Context)throw new Error('This browser does not support the φ spectrum');
   const ctx=new Context();
   try{
     const media=ctx.createMediaElementSource(audio);
     const original=ctx.createGain(),processed=ctx.createGain(),master=ctx.createGain();
     original.gain.value=1;processed.gain.value=0;master.gain.value=1;
     media.connect(original);original.connect(master);
     let tail=media;
     const nodes=[];
     for(const band of bands){
       const filter=ctx.createBiquadFilter();
       filter.type='peaking';filter.frequency.value=band.frequency;
       filter.Q.value=band.Q;filter.gain.value=band.gain;
       tail.connect(filter);tail=filter;nodes.push(filter);
     }
     tail.connect(processed);processed.connect(master);master.connect(ctx.destination);
     context=ctx;source=media;dry=original;wet=processed;output=master;filters=nodes;
   }catch(error){void ctx.close();throw error;}
 }
 async function setEnabled(value){
   if(disposed)throw Error('Gramophone spectrum has been disposed');
   if(value)initialise();
   if(!context){enabled=false;return false;}
   // Resume immediately on the originating click, before any awaited work.
   await context.resume();
   if(disposed)return false;
   enabled=!!value;
   const now=context.currentTime;
   dry.gain.cancelScheduledValues(now);wet.gain.cancelScheduledValues(now);
   dry.gain.setTargetAtTime(enabled?0:1,now,.035);
   wet.gain.setTargetAtTime(enabled?.72:0,now,.035);
   return enabled;
 }
 return {
   bands,
   state:()=>({enabled,initialised:!!context,filters:filters.length}),
   setEnabled,
   toggle:()=>setEnabled(!enabled),
   dispose(){
     disposed=true;enabled=false;
     try{source?.disconnect();dry?.disconnect();wet?.disconnect();output?.disconnect();
       for(const filter of filters)filter.disconnect();}catch{}
     if(context)void context.close();
   }
 };
}
