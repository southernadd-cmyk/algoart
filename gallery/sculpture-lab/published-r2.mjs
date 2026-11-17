// Use the production reader, including its manifest and compressed-pack hashes.
import {downloadV2Prepared} from '../sculpture-v2-test/v2-pack-loader.mjs';

let currentKey = '', currentRequest = null;
export async function publishedStudy(date, entry, quality) {
  const key = date + ':' + quality;
  if (currentKey !== key || !currentRequest) {
    currentKey = key;
    const request = downloadV2Prepared(date, quality);
    currentRequest = request;
    request.catch(() => {
      if (currentRequest === request) currentRequest = null;
    });
  }
  const floor = await currentRequest;
  const study = floor.studies[entry.imageFile];
  if (!study || study.seed !== entry.seed || study.quality !== quality ||
      study.method !== 'assembly' || study.coverage !== 1 || study.omittedCells !== 0)
    throw Error('Published R2 sculpture does not match this archived portrait');
  return {study, transport: floor.__v2Transport};
}
