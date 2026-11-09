export const FIRST_CONFLUENCE_DATE = '2026-11-09';

export function confluencePairCount(date) {
  // The first published edition contains four immutable studies.
  return date === FIRST_CONFLUENCE_DATE ? 2 : 1;
}

export function hasConfluencePairs(entries, pairCount) {
  return entries.length === 2 * pairCount && ['portrait', 'landscape'].every(orientation =>
    entries.filter(entry => entry.orientation === orientation).length === pairCount);
}

export function validateRandomGalleryEdition(date, entries) {
  const pairCount = confluencePairCount(date);
  const solo = entries.filter(entry => entry.material !== 'confluence' && /-G\d{2}$/.test(entry.id));
  const confluence = entries.filter(entry => entry.material === 'confluence' && /-C\d{2}$/.test(entry.id));
  if (date < FIRST_CONFLUENCE_DATE || entries.length !== 12 + 2 * pairCount ||
      solo.length !== 12 || !hasConfluencePairs(confluence, pairCount)) {
    throw Error(`Daily gallery for ${date} needs 12 solo studies and ${pairCount} Confluence pair(s).`);
  }
  if (new Set(entries.map(entry => entry.seed)).size !== entries.length || entries.some(entry =>
    !entry.seed || entry.rendererVersion !== 10 || (entry.material === 'confluence'
      ? !new URL(entry.shareUrl).searchParams.has('s')
      : new URL(entry.shareUrl).searchParams.get('v') !== '10'))) {
    throw Error('New gallery studies need distinct seeds and links to their recorded renderers.');
  }
}
