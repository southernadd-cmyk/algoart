import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {imageSize} from '../automation/image-size.mjs';

const day = 'gallery/2026-11-14/';

test('reads archived JPEG dimensions from the frame header', () => {
  const data = readFileSync(day + '2026-11-14-G01-action-rects-landscape.jpg');
  assert.deepEqual(imageSize(data, 'image/jpeg'), {width: 1400, height: 1000});
});

test('reads lossy WebP texture dimensions', () => {
  assert.deepEqual(imageSize(readFileSync(day + '3d/2026-11-14-C01-portrait-1100.webp'), 'image/webp'), {width: 786, height: 1100});
  assert.deepEqual(imageSize(readFileSync(day + '3d/2026-11-14-C01-portrait-640.webp'), 'image/webp'), {width: 457, height: 640});
});

test('reads lossless and extended WebP headers', () => {
  const vp8l = Buffer.alloc(30);
  vp8l.write('RIFF', 0); vp8l.write('WEBP', 8); vp8l.write('VP8L', 12);
  vp8l.writeUInt32LE(((300 - 1) & 0x3fff) | (((200 - 1) & 0x3fff) << 14), 21);
  assert.deepEqual(imageSize(vp8l, 'image/webp'), {width: 300, height: 200});
  const vp8x = Buffer.alloc(30);
  vp8x.write('RIFF', 0); vp8x.write('WEBP', 8); vp8x.write('VP8X', 12);
  vp8x.writeUIntLE(1099, 24, 3); vp8x.writeUIntLE(785, 27, 3);
  assert.deepEqual(imageSize(vp8x, 'image/webp'), {width: 1100, height: 786});
});

test('returns null for unreadable data', () => {
  assert.equal(imageSize(Buffer.from([0xff, 0xd8, 0, 0]), 'image/jpeg'), null);
  assert.equal(imageSize(Buffer.alloc(10), 'image/webp'), null);
});
