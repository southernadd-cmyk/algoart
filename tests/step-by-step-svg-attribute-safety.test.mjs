import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../about/step-by-step/index.html', import.meta.url), 'utf8');

test('walkthrough validates URL-provided paper colour', () => {
  assert.match(html, /if\(incomingSettings\.paper&&!\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(incomingSettings\.paper\)\)/);
});

test('walkthrough escapes paper colour at the SVG markup boundary', () => {
  assert.ok(html.includes(`fill="'+esc(s.paper)+'"`));
  assert.ok(!html.includes(`fill="'+s.paper+'"`));
});

test('previously exploitable paper parameter fails the accepted colour schema', () => {
  const valid = /^#[0-9a-f]{6}$/i;
  const injected = '"/><image href="x" onerror="alert(document.domain)"/><rect x="';
  assert.equal(valid.test(injected), false);
  assert.equal(valid.test('#f5f0e6'), true);
});
