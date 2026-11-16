import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseCatchUp, londonNow, slotHasMarker} from '../automation/social-catch-up.mjs';

const date = '2026-11-16';
const at = (hh, mm) => ({date, minutes: hh * 60 + mm});

test('catches up the morning slot when the gallery went live late', () => {
  assert.deepEqual(chooseCatchUp({date, now: at(11, 10), assetNames: [], socialActive: false}), {slot: 0});
});

test('chooses only the latest due production slot', () => {
  assert.deepEqual(chooseCatchUp({date, now: at(16, 0), assetNames: [], socialActive: false}), {slot: 1});
  assert.deepEqual(chooseCatchUp({date, now: at(23, 59), assetNames: [], socialActive: false}), {slot: 2});
});

test('never re-runs a slot with any completion marker for that date', () => {
  const assetNames = ['done-2026-11-16-portrait-slot0-threads.txt'];
  assert.deepEqual(chooseCatchUp({date, now: at(11, 0), assetNames, socialActive: false}), {skip: 'latest-slot-done'});
  assert.equal(slotHasMarker(['done-2026-11-15-slot0-instagram.txt'], date, 0), false);
  assert.equal(slotHasMarker(['done-2026-11-16-slot10-x.txt'], date, 0), false);
});

test('stands down before the first slot, on other days, or while social is running', () => {
  assert.deepEqual(chooseCatchUp({date, now: at(8, 59), assetNames: [], socialActive: false}), {skip: 'no-slot-due'});
  assert.deepEqual(chooseCatchUp({date: '2026-11-15', now: at(11, 0), assetNames: [], socialActive: false}), {skip: 'not-today'});
  assert.deepEqual(chooseCatchUp({date, now: at(11, 0), assetNames: [], socialActive: true}), {skip: 'social-active'});
});

test('uses the London calendar and clock across BST', () => {
  assert.deepEqual(londonNow(new Date('2027-06-01T23:30:00Z')), {date: '2027-06-02', minutes: 30});
});
