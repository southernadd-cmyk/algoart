import {waitForPublishedR2Edition} from './r2-gallery-media.mjs';

const date = process.argv[2];
// Each attempt waits 10 seconds. Default 30 (5 minutes); callers that can
// afford to wait for a late gallery build may raise it.
const attempts = Number(process.env.R2_WAIT_ATTEMPTS || 30);
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 360) throw Error('Invalid R2_WAIT_ATTEMPTS');
const publication = await waitForPublishedR2Edition(date, {attempts});
console.log('Pages is serving the R2 edition:', date, publication.count, 'artworks');
