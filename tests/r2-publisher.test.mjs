import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {MEDIA, readArchivedJpeg, sha256, waitForPublishedR2Edition} from '../automation/r2-gallery-media.mjs';

const date = '2026-11-09';
const edition = 'gallery/' + date;
const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));

test('a complete edition can switch to verified R2 and roll back without changing artwork', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pp-r2-canary-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const checkout = path.join(dir, 'checkout');
  const stage = path.join(dir, 'stage');
  await fs.cp(path.join(root, edition), path.join(checkout, edition), {recursive: true});
  for (const file of ['index.html', 'archive.json', 'feed.xml']) {
    await fs.copyFile(path.join(root, 'gallery', file), path.join(checkout, 'gallery', file));
  }
  const env = {...process.env, R2_STAGE_OUTPUT: stage, R2_STAGE_SOURCE: checkout, R2_EDITION_DATE: date};
  const run = (command, args) => execFileSync(command, args, {cwd: checkout, env, encoding: 'utf8'});
  const git = (...args) => run('git', args);
  const activate = () => spawnSync(process.execPath, [path.join(root, 'automation/activate-r2-daily.mjs')], {
    cwd: checkout, env, encoding: 'utf8'
  });
  git('init', '-q');
  git('config', 'user.name', 'R2 fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('add', '.');
  git('commit', '-qm', 'Pages fallback');
  const pagesTree = git('rev-parse', 'HEAD^{tree}').trim();
  run(process.execPath, [path.join(root, 'automation/prepare-r2-daily.mjs')]);
  const raw = await fs.readFile(path.join(stage, 'media-publication.json'));
  const manifest = JSON.parse(raw);
  assert.equal(manifest.mediaAssets.length, 50);
  assert.equal(manifest.published, false);
  assert.equal(git('status', '--porcelain'), '');
  assert.notEqual(activate().status, 0);
  assert.equal(git('status', '--porcelain'), '');
  await fs.writeFile(path.join(stage, 'upload-verification.json'),
    JSON.stringify({date, manifestSha256: sha256(raw), verified: 49}));
  assert.notEqual(activate().status, 0);
  assert.equal(git('status', '--porcelain'), '');
  await fs.writeFile(path.join(stage, 'upload-verification.json'),
    JSON.stringify({date, manifestSha256: sha256(raw), verified: 50}));
  assert.equal(activate().status, 0);
  const published = await readJson(path.join(checkout, edition, 'media-publication.json'));
  const meta = await readJson(path.join(checkout, edition, 'meta.json'));
  const original = await readJson(path.join(root, edition, 'meta.json'));
  assert.equal(published.published, true);
  assert.deepEqual(meta.entries.map(({media, ...entry}) => entry), original.entries);
  for (const asset of published.mediaAssets) {
    assert.equal(sha256(await fs.readFile(path.join(checkout, asset.sourcePath))), asset.sha256);
  }
  const archive = await readJson(path.join(checkout, 'gallery/archive.json'));
  const prior = await readJson(path.join(root, 'gallery/archive.json'));
  assert.deepEqual(archive.days.filter(day => day.date !== date), prior.days.filter(day => day.date !== date));
  assert((await fs.readFile(path.join(checkout, 'gallery/feed.xml'), 'utf8')).includes(meta.mediaCover));
  git('add', '.');
  git('commit', '-qm', 'R2 read switch');
  git('revert', '--no-edit', 'HEAD');
  assert.equal(git('rev-parse', 'HEAD^{tree}').trim(), pagesTree);
});

test('social and recovery readers reject corrupt or redirected R2 media', async t => {
  const bytes = Buffer.alloc(1500, 12);
  const hash = sha256(bytes);
  const id = date + '-G01';
  const item = {id, imageFile: 'artwork.jpg', media: {
    original: MEDIA + '/editions/' + date + '/' + id + '/original-' + hash + '.jpg',
    originalSha256: hash, originalBytes: bytes.length
  }};
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, item.media.original);
    assert.equal(options.redirect, 'error');
    return new Response(bytes, {headers: {'Content-Type': 'image/jpeg'}});
  });
  assert.deepEqual(await readArchivedJpeg(root, item), bytes);
  fetch.mock.mockImplementation(async () => new Response(Buffer.alloc(bytes.length), {
    headers: {'Content-Type': 'image/jpeg'}
  }));
  await assert.rejects(readArchivedJpeg(root, item), /failed verification/);
  item.media.original = 'https://example.invalid/bad.jpg';
  await assert.rejects(readArchivedJpeg(root, item), /Invalid archived media/);
  assert.equal(fetch.mock.callCount(), 2);
});

test('social publishing waits for the deployed page to use the verified media', async t => {
  const url = MEDIA + '/editions/' + date + '/test.jpg';
  const mediaAssets = [{role: 'original', url}, ...Array(4).fill({role: 'other'})];
  const receipt = {schemaVersion: 2, date, count: 1, published: true, stageOnly: false,
    workerBase: MEDIA, mediaAssets};
  let html = '<img src="artwork.jpg">';
  t.mock.method(globalThis, 'fetch', async address => new URL(address).pathname.endsWith('.json')
    ? Response.json(receipt) : new Response(html));
  await assert.rejects(waitForPublishedR2Edition(date, {attempts: 1}), /has not deployed/);
  html = '<img src="' + url + '">';
  assert.deepEqual(await waitForPublishedR2Edition(date, {attempts: 1}), receipt);
});

test('social publishing accepts a complete R2 artwork-only edition without V1 geometry', async t => {
  const url = MEDIA + '/editions/' + date + '/test.jpg';
  const receipt = {schemaVersion:2,date,count:1,published:true,stageOnly:false,
    pagesFallback:false,workerBase:MEDIA,mediaAssets:[
      {role:'original',url},
      {role:'desktop',url:MEDIA+'/editions/'+date+'/desktop.webp'},
      {role:'mobile',url:MEDIA+'/editions/'+date+'/mobile.webp'},
      {role:'cover',url:MEDIA+'/editions/'+date+'/cover.jpg'}
    ]};
  t.mock.method(globalThis,'fetch',async address=>new URL(address).pathname.endsWith('.json')
    ? Response.json(receipt) : new Response('<img src="'+url+'">'));
  assert.deepEqual(await waitForPublishedR2Edition(date,{attempts:1}),receipt);
});
