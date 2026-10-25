// Stable identities and independently publishable revisions for the eight
// curated tower alphabets. The legacy revision uses the existing writer grammar.
// Historical atlases should record the selected revision before regeneration.
export const ALPHABET_MANIFEST_VERSION=1;
export const ALPHABETS=Object.freeze({
 guess:Object.freeze({id:'guess',revision:1,renderer:'legacy'}),
 faust:Object.freeze({id:'faust',revision:1,renderer:'legacy'}),
 revok:Object.freeze({id:'revok',revision:1,renderer:'legacy'}),
 kadism:Object.freeze({id:'kadism',revision:1,renderer:'legacy'}),
 zephyr:Object.freeze({id:'zephyr',revision:1,renderer:'legacy'}),
 gorey:Object.freeze({id:'gorey',revision:1,renderer:'legacy'}),
 skofe:Object.freeze({id:'skofe',revision:1,renderer:'legacy'}),
 skuf:Object.freeze({id:'skuf',revision:1,renderer:'legacy'})
});
export const TOWER_HANDS=Object.freeze(Object.keys(ALPHABETS));
export function alphabetRevision(id){
 const entry=ALPHABETS[id];
 if(!entry)throw new RangeError('Unknown curated alphabet: '+id);
 return entry.revision;
}
export function alphabetIdentity(id,revision=alphabetRevision(id)){
 if(!Number.isSafeInteger(revision)||revision<1)throw new RangeError('Invalid alphabet revision');
 return id+'@'+revision;
}
export function pickTowerHand(random){return TOWER_HANDS[Math.floor(random.n()*TOWER_HANDS.length)];}

/**
 * Resolve a recorded atlas identity. Unknown revisions are rejected instead of
 * silently rendering them with the latest alphabet (which would rewrite history).
 * Revision 1 is the existing, unmodified procedural writer grammar.
 */
export function resolveAlphabetIdentity(identity){
 const match=/^([a-z][a-z0-9-]*)@([1-9][0-9]*)$/.exec(String(identity));
 if(!match)throw new RangeError('Malformed alphabet identity: '+identity);
 const id=match[1],revision=Number(match[2]);
 if(!Number.isSafeInteger(revision)||!ALPHABETS[id]||ALPHABETS[id].revision!==revision)
  throw new RangeError('Unavailable alphabet revision: '+identity);
 return ALPHABETS[id];
}
