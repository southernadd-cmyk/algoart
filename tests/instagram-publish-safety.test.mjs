import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_RETRY_DELAYS_MS,
  isInstagramMediaNotReady,
  publishInstagramContainerSafely
} from '../automation/instagram-publish-safety.mjs';

const notReady = new Error(JSON.stringify({ error: {
  message: 'The media is not ready for publishing',
  type: 'OAuthException', code: 9007, error_subcode: 2207027, is_transient: false
} }));

// Fake calls never access the network or publish real Instagram media.
test('recognises only the exact Meta media-not-ready error', () => {
  assert.equal(isInstagramMediaNotReady(notReady), true);
  for (const error of [
    new Error('Network timeout'),
    new Error(JSON.stringify({ error: { code: 9007, error_subcode: 1 } })),
    new Error(JSON.stringify({ error: { code: 190, error_subcode: 2207027 } })),
    new Error('not JSON')
  ]) assert.equal(isInstagramMediaNotReady(error), false);
});

test('successful publish issues one request and waits zero times', async () => {
  const calls = [], waits = [];
  const published = await publishInstagramContainerSafely({
    graph: async (...args) => { calls.push(args); return { id: 'posted-1' }; },
    userId: 'me', containerId: 'existing-container',
    sleep: async ms => waits.push(ms)
  });
  assert.deepEqual(published, { id: 'posted-1' });
  assert.deepEqual(calls, [['me/media_publish', { creation_id: 'existing-container' }]]);
  assert.deepEqual(waits, []);
});

test('propagation failure retries only the same container then succeeds', async () => {
  const calls = [], waits = [];
  const result = await publishInstagramContainerSafely({
    graph: async (...args) => {
      calls.push(args);
      if (calls.length < 3) throw notReady;
      return { id: 'posted-2' };
    },
    userId: 'me', containerId: 'container-123',
    retryDelaysMs: [3000, 5000], sleep: async ms => waits.push(ms)
  });
  assert.deepEqual(result, { id: 'posted-2' });
  assert.deepEqual(waits, [3000, 5000]);
  assert.deepEqual(calls, Array(3).fill(null).map(() =>
    ['me/media_publish', { creation_id: 'container-123' }]));
});

test('permanent error or ambiguous timeout is not retried', async () => {
  for (const error of [
    new Error('fetch failed'),
    new Error(JSON.stringify({ error: { code: 190, message: 'Invalid token' } })),
    new Error('Instagram publish response has no media id.')
  ]) {
    let calls = 0;
    await assert.rejects(() => publishInstagramContainerSafely({
      graph: async () => { calls++; throw error; },
      userId: 'me', containerId: 'same', sleep: async () => {}
    }), e => e === error);
    assert.equal(calls, 1);
  }
});

test('bounded not-ready retries exhaust without recreating a container', async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(() => publishInstagramContainerSafely({
    graph: async (path, params) => {
      calls++;
      assert.equal(path, 'me/media_publish');
      assert.equal(params.creation_id, 'same-container');
      throw notReady;
    },
    userId: 'me', containerId: 'same-container',
    retryDelaysMs: [1, 2, 3], sleep: async ms => waits.push(ms)
  }), e => e === notReady);
  assert.equal(calls, 4);
  assert.deepEqual(waits, [1, 2, 3]);
  assert.ok(DEFAULT_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0) <= 60000);
});

test('live publisher invokes guarded publishing after container readiness polling', () => {
  const source = readFileSync(new URL('../automation/publish-instagram.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ publishInstagramContainerSafely \}/);
  assert.match(source, /status_code === 'FINISHED'/);
  assert.match(source, /publishInstagramContainerSafely\(\{ graph, userId: USER_ID, containerId: container\.id \}\)/);
});
