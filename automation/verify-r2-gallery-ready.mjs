import {waitForPublishedR2Edition} from './r2-gallery-media.mjs';

const date = process.argv[2];
const publication = await waitForPublishedR2Edition(date);
console.log('Pages is serving the R2 edition:', date, publication.count, 'artworks');
