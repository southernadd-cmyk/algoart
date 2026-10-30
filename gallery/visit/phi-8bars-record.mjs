// Test-tower experiment: one original 20-second study composed by 8bars,
// realised with its recorded sample library, then overlaid with exact phi-ratio
// pitch transpositions. No extra room, live radio iframe, or page-load audio.
export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_STUDY = Object.freeze({
  seed: 'proportion-piece-gramophone-phi-01',
  bpm: 96,
  duration: 20,
  climax: 20 / PHI,
  form: '8 bars; 5+3 turn, phi climax',
  source: 'https://github.com/southernadd-cmyk/8bars'
});

const EIGHT_BARS_BASE = 'https://southernadd-cmyk.github.io/8bars/';

export function planGoldenStudy(compose,{seed=GOLDEN_STUDY.seed}={}) {
  const piece = compose({
    seed, key:'A', mode:'minor',
    style:'ambient', engine:'melodic', bpm:GOLDEN_STUDY.bpm,
    density:.39, swing:0
  });
  if(!Array.isArray(piece.events) || piece.bars!==8)
    throw new Error('8bars did not return an eight-bar composition');
  const chosen = new Set(['lead','pad','bass','chords']);
  const events=piece.events.filter(e=>chosen.has(e.track)&&Number.isFinite(e.note)&&
    Number.isFinite(e.step)&&e.step>=0&&e.step<128&&Number.isFinite(e.duration));
  if(!events.length)throw new Error('8bars supplied no playable notes');
  return {piece,events};
}

export function goldenPitchRates(semitoneRate) {
  return [semitoneRate,semitoneRate*PHI];
}

export function encodeWav(audio) {
  const data=audio.getChannelData(0),out=new ArrayBuffer(44+data.length*2),v=new DataView(out);
  const word=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};
  word(0,'RIFF');v.setUint32(4,out.byteLength-8,true);word(8,'WAVE');
  word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,1,true);v.setUint32(24,audio.sampleRate,true);
  v.setUint32(28,audio.sampleRate*2,true);v.setUint16(32,2,true);
  v.setUint16(34,16,true);word(36,'data');v.setUint32(40,data.length*2,true);
  for(let i=0;i<data.length;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
  return new Blob([out],{type:'audio/wav'});
}

export async function render8barsGoldenStudy({
  importModule=(path)=>import(EIGHT_BARS_BASE+path),
  fetchSample=(url)=>fetch(url,{cache:'force-cache'}),
  AudioContextClass=globalThis.OfflineAudioContext,
  seed=GOLDEN_STUDY.seed
}={}) {
  if(!AudioContextClass)throw Error('Offline audio rendering is not supported in this browser');
  const [engine,library,map]=await Promise.all([
    importModule('music-engines.js'),
    importModule('sounds.js'),
    importModule('sample-map.js')
  ]);
  const {events}=planGoldenStudy(engine.composeWithEngine,{seed});
  const samples={
    lead:library.nearestSample('pianoSoft',72),
    pad:library.nearestSample('harmonium',60),
    bass:library.nearestSample('electricBass',48),
    chords:library.nearestSample('pianoSoft',60)
  };
  // The mirrored source recordings are built by 8bars on its own Pages origin.
  // Fail explicitly rather than substituting oscillator sounds or silent notes.
  const unique=[...new Map(Object.values(samples).map(s=>[s.url,s])).values()];
  const sampleRate=22050;
  const offline=new AudioContextClass(1,sampleRate*GOLDEN_STUDY.duration,sampleRate);
  const decoded=new Map();
  await Promise.all(unique.map(async sample=>{
    const relative=map.LOCAL_SAMPLES?.[sample.url];
    if(!relative)throw Error('8bars recording not mirrored: '+sample.url);
    const url=new URL(relative,EIGHT_BARS_BASE).href;
    const response=await fetchSample(url);
    if(!response.ok)throw Error('8bars recording HTTP '+response.status);
    const audio=await offline.decodeAudioData(await response.arrayBuffer());
    if(!audio?.length)throw Error('8bars recording is empty');
    decoded.set(sample.url,audio);
  }));
  const bus=offline.createGain();
  bus.gain.value=.58;
  const limiter=offline.createDynamicsCompressor();
  limiter.threshold.value=-10;
  limiter.ratio.value=5;
  bus.connect(limiter);limiter.connect(offline.destination);
  const schedule=(sample,pitch,onset,length,volume)=>{
    if(!Number.isFinite(onset)||onset<0||onset>=GOLDEN_STUDY.duration)return;
    const buffer=decoded.get(sample.url);
    const rate=Math.pow(2,(pitch-sample.root)/12);
    const duration=Math.min(length,buffer.duration/rate,GOLDEN_STUDY.duration-onset);
    if(duration<.025)return;
    const src=offline.createBufferSource(),amp=offline.createGain();
    src.buffer=buffer;src.playbackRate.value=rate;
    const fade=Math.min(.12,duration*.28);
    amp.gain.setValueAtTime(.0001,onset);
    amp.gain.linearRampToValueAtTime(volume,onset+Math.min(.026,duration*.16));
    amp.gain.setValueAtTime(volume,onset+Math.max(.027,duration-fade));
    amp.gain.linearRampToValueAtTime(.0001,onset+duration);
    src.connect(amp);amp.connect(bus);
    src.start(onset);src.stop(onset+duration+.002);
  };
  // Keep 8bars' composed pitch/rhythm and 5+3 phrase layout.
  const roleVolume={lead:.25,pad:.095,bass:.14,chords:.07};
  for(const e of events){
    const when=e.step*GOLDEN_STUDY.duration/128;
    const length=Math.min(2.5,Math.max(.13,e.duration*GOLDEN_STUDY.duration/128));
    const nearest=samples[e.track];
    const touch=e.track==='lead'&&when>10?.9:1;
    schedule(nearest,e.note,when,length,roleVolume[e.track]*Math.max(.12,e.velocity)*touch);
  }
  // Exact frequency-ratio test: a *single recorded note* is played twice with
  // playback rates in the ratio 1:phi. The 8bars notes retain their own tuning.
  const probe=samples.pad,pitch=57,baseRate=Math.pow(2,(pitch-probe.root)/12);
  const pair=goldenPitchRates(baseRate);
  const probeBuffer=decoded.get(probe.url);
  for(const time of [0,3.125,5,8.125,GOLDEN_STUDY.climax,16.125]){
    const accent=Math.abs(time-GOLDEN_STUDY.climax)<.01?.18:.095;
    for(let voice=0;voice<2;voice++){
      const rate=pair[voice],length=Math.min(1.65,probeBuffer.duration/rate,GOLDEN_STUDY.duration-time);
      if(length<.03)continue;
      const src=offline.createBufferSource(),gain=offline.createGain();
      src.buffer=probeBuffer;src.playbackRate.value=rate;
      gain.gain.setValueAtTime(.0001,time);
      gain.gain.linearRampToValueAtTime(accent*(voice===0?1:.83),time+.045);
      gain.gain.setValueAtTime(accent*(voice===0?1:.83),time+Math.max(.05,length-.18));
      gain.gain.linearRampToValueAtTime(.0001,time+length);
      src.connect(gain);gain.connect(bus);src.start(time);src.stop(time+length+.002);
    }
  }
  const rendered=await offline.startRendering();
  return encodeWav(rendered);
}

export function create8barsGoldenTrack({render=render8barsGoldenStudy,seed=GOLDEN_STUDY.seed,edition=1}={}) {
  let url=null,pending=null,released=false;
  return {
    title:'Golden Frequency · study '+edition,
    composer:'8bars × PROPORTION PIECE',
    credit:'Original 8bars-generated arrangement · recorded instrumental samples; pitch comparison at 1:φ',
    goldenStudy:true,repeat:true,seed,edition,
    get src(){if(!url)throw Error('The golden study is not prepared');return url;},
    async prepare(){
      if(released)throw Error('Record has been disposed');
      if(url)return url;
      if(!pending)pending=Promise.resolve().then(()=>render({seed})).then(blob=>{
        if(released)return null;
        if(!blob||!blob.size)throw Error('Empty composition');
        url=URL.createObjectURL(blob);
        return url;
      }).catch(error=>{pending=null;throw error;});
      return pending;
    },
    release(){released=true;if(url){URL.revokeObjectURL(url);url=null;}}
  };
}
