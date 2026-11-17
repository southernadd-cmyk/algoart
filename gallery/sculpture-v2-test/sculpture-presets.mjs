import config from './sculpture-presets.json' with {type:'json'};
export const PUBLISHED_PRESET_ID=config.active;
export function sculpturePreset(id=PUBLISHED_PRESET_ID){
  const preset=config.presets[id];
  if(!preset)throw Error('Unknown sculpture preset: '+id);
  return preset;
}
