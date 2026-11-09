// Apply an already-verified canary overlay to the checked-out Pages source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const stage = path.resolve(process.env.R2_STAGE_OUTPUT);
const raw = await fs.readFile(path.join(stage, 'media-publication.json'));
const manifest = JSON.parse(raw);
const verification = JSON.parse(await fs.readFile(path.join(stage, 'upload-verification.json'), 'utf8'));
const hash = createHash('sha256').update(raw).digest('hex');
const date = process.env.R2_EDITION_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || manifest.date !== date || verification.date !== date ||
    manifest.schemaVersion !== 2 || manifest.stageOnly !== true || manifest.published !== false ||
    verification.manifestSha256 !== hash || verification.verified !== manifest.mediaAssets.length) {
  throw Error('The staged edition must match its complete public media verification.');
}

const edition = 'gallery/' + date;
for (const file of ['index.html', 'meta.json', '3d/manifest.json'].map(name => edition + '/' + name)
  .concat(['gallery/index.html', 'gallery/archive.json', 'gallery/feed.xml'])) {
  await fs.copyFile(path.join(stage, file), file);
}
await fs.writeFile(edition + '/media-publication.json', JSON.stringify({
  ...manifest, stageOnly: false, published: true
}, null, 2) + '\n');
