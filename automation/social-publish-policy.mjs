// Curated platform quotas for the existing three Europe/London social slots.
// Artwork generation/archiving is independent; this module gates publication only.
// Selection is deterministic by calendar date, so retries never publish new picks.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

export const SLOT_CANDIDATES=Object.freeze({
  0: Object.freeze(['marker-landscape','action-landscape','tissue-landscape',
                    'marker-portrait','action-portrait','tissue-portrait']),
  1: Object.freeze(['marker-landscape','watercolour-landscape','oil-landscape',
                    'marker-portrait','watercolour-portrait','oil-portrait']),
  2: Object.freeze(['marker-landscape','tissue-landscape',
                    'marker-portrait','tissue-portrait'])
});
export const PLATFORM_TARGETS=Object.freeze({
  instagram:Object.freeze([1,2,1]),
  threads:Object.freeze([1,0,1]),
  bluesky:Object.freeze([1,2,1]),
  pinterest:Object.freeze([1,1,1])
});
const PLATFORMS=Object.keys(PLATFORM_TARGETS);
const ROTATIONS={instagram:0,threads:2,bluesky:3,pinterest:4};

export function selectedSocialJobs(date,slot,platform){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid social date: '+date);
  const parsed=new Date(date+'T12:00:00Z');
  if(Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==date)
    throw Error('Invalid social calendar date: '+date);
  if(!PLATFORMS.includes(platform))throw Error('Unknown platform: '+platform);
  // Slot 3 is a legacy noon test slot; never publish from it.
  if(!Object.hasOwn(SLOT_CANDIDATES,String(slot)))return [];
  // The evening Threads post is sent by the base job, which selects its
  // image from the completed daily archive (including afternoon materials).
  if(platform==='threads' && String(slot)==='2')return ['marker-landscape'];
  const available=SLOT_CANDIDATES[slot];
  // Pinterest primarily features the vertical originals.
  const choices=platform==='pinterest'
    ? available.filter(job=>job.endsWith('-portrait'))
    : available;
  const quantity=PLATFORM_TARGETS[platform][slot];
  const day=Math.floor(parsed.valueOf()/86_400_000);
  const first=((day+ROTATIONS[platform]+Number(slot)*3)%choices.length+choices.length)%choices.length;
  return Array.from({length:quantity},(_,i)=>choices[(first+i)%choices.length]);
}

export function socialPublishDecision({date,slot,job}){
  if(typeof job!=='string'||!job.trim())throw Error('Missing social job identity');
  const allowed=SLOT_CANDIDATES[slot]||[];
  if(!allowed.includes(job)){
    if(String(slot)!=='3')throw Error('Unknown publishing job '+job+' for slot '+slot);
  }
  return Object.fromEntries(PLATFORMS.map(platform=>[
    platform,selectedSocialJobs(date,slot,platform).includes(job)
  ]));
}

async function main(){
  const date=process.env.SOCIAL_DATE,slot=process.env.SOCIAL_SLOT,job=process.env.SOCIAL_PUBLISH_JOB;
  const decisions=socialPublishDecision({date,slot,job});
  const out=Object.entries(decisions).map(([key,value])=>key+'='+value).join('\n')+'\n';
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,out);
  else process.stdout.write(out);
  console.log('Publishing policy:',date,'slot',slot,job,JSON.stringify(decisions));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
