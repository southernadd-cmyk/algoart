import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export const PAGES = 'https://southernadd-cmyk.github.io';
export const GALLERY = PAGES + '/algoart/gallery/';
export const MEDIA = 'https://proportion-piece-media.mr-adam-clement.workers.dev';
export const sha256 = data => createHash('sha256').update(data).digest('hex');

async function get(url) {
  const response = await fetch(url, {redirect: 'error', signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw Error('HTTP ' + response.status + ' for ' + url);
  return response;
}

export async function readArchivedJpeg(directory, item) {
  const file = path.resolve(directory, item.imageFile);
  if (!file.startsWith(path.resolve(directory) + path.sep)) throw Error('Image path escapes archive');
  if (!item.media) return fs.readFile(file);

  const match = /^(\d{4}-\d{2}-\d{2})-[\w-]+$/.exec(item.id);
  const {original, originalSha256, originalBytes} = item.media;
  if (!match || !/^[a-f0-9]{64}$/.test(originalSha256) ||
      original !== `${MEDIA}/editions/${match[1]}/${item.id}/original-${originalSha256}.jpg` ||
      !Number.isSafeInteger(originalBytes) || originalBytes < 1000) {
    throw Error('Invalid archived media for ' + item.id);
  }
  const response = await get(original);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.headers.get('content-type') !== 'image/jpeg' ||
      bytes.length !== originalBytes || sha256(bytes) !== originalSha256) {
    throw Error('Archived R2 JPEG failed verification: ' + item.id);
  }
  return bytes;
}

export async function waitForPublishedR2Edition(date, {attempts = 30} = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Invalid edition date');
  const edition = GALLERY + date + '/';
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // Pages may cache the previous edition or a pre-deploy 404.
      const probe = '?r2-check=' + Date.now();
      const [receipt, page] = await Promise.all([
        get(edition + 'media-publication.json' + probe).then(response => response.json()),
        get(edition + probe).then(response => response.text())
      ]);
      if (receipt.schemaVersion !== 2 || receipt.date !== date || receipt.published !== true ||
          receipt.stageOnly !== false || receipt.workerBase !== MEDIA ||
          !Array.isArray(receipt.mediaAssets) || receipt.mediaAssets.length !== receipt.count * 3 + 2) {
        throw Error('Published R2 manifest is incomplete');
      }
      const originals = receipt.mediaAssets.filter(asset => asset.role === 'original');
      if (originals.length !== receipt.count || !originals.every(asset =>
        asset.url.startsWith(MEDIA + '/editions/' + date + '/') &&
        page.includes('src="' + asset.url + '"'))) {
        throw Error('Pages has not deployed the verified edition');
      }
      return receipt;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await delay(10_000);
    }
  }
  throw Error('Waited for the R2 edition on Pages: ' + lastError.message);
}
