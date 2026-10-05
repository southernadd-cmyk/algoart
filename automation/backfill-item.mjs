import fs from 'node:fs/promises';
import path from 'node:path';

const day = String(process.env.SOCIAL_DATE || '').trim();
const index = Number(process.env.INDEX);

if (!day) throw new Error('SOCIAL_DATE is required.');
if (!Number.isInteger(index) || index < 0) throw new Error('INDEX must be a non-negative integer.');

const queuePath = path.resolve('social-output', day, 'queue.json');
const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));
const item = queue.entries[index];

if (!item) throw new Error(`No queue entry at index ${index}.`);

const imagePath = path.resolve('social-output', day, item.imageFile);
await fs.access(imagePath);

const b64 = value => Buffer.from(String(value || ''), 'utf8').toString('base64');

process.stdout.write(JSON.stringify({
  index,
  id: item.id,
  imagePath,
  imageFile: item.imageFile,
  seed: item.seed,
  instagramCaptionB64: b64(item.copy.instagram),
  threadsCaptionB64: b64(item.copy.threads),
  altTextB64: b64(item.copy.altText),
  shareUrl: item.shareUrl
}));
