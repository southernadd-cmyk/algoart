#!/usr/bin/env node
// After a late gallery publication or recovery, re-run the most recent social
// slot that is already due today and has no completion marker. A social slot
// that ran before the edition was live failed without posting; nothing else
// retries it. Same London day only; done-markers still prevent duplicates.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {TIME_ZONE, SCHEDULE} from './config.mjs';

// Slot 3 is an externally-triggered test slot; never catch it up.
const PRODUCTION_SLOTS = [0, 1, 2];
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

export function londonNow(at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(at).map(({type, value}) => [type, value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)};
}

const toMinutes = text => {
  const [h, m] = String(text).split(':').map(Number);
  return h * 60 + m;
};

export function slotHasMarker(assetNames, date, slot) {
  const prefix = `done-${date}-`;
  return assetNames.some(name => name.startsWith(prefix) && name.includes(`slot${slot}-`));
}

// Pure decision: returns {slot} to dispatch, or {skip: reason}.
export function chooseCatchUp({date, now, assetNames, socialActive}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return {skip: 'invalid-date'};
  if (date !== now.date) return {skip: 'not-today'};
  if (socialActive) return {skip: 'social-active'};
  const due = PRODUCTION_SLOTS.filter(slot => now.minutes >= toMinutes(SCHEDULE.instagram[slot]));
  if (!due.length) return {skip: 'no-slot-due'};
  const latest = due[due.length - 1];
  if (slotHasMarker(assetNames, date, latest)) return {skip: 'latest-slot-done'};
  return {slot: latest};
}

function gh(args) {
  return execFileSync('gh', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
}

async function main() {
  const date = process.env.EDITION_DATE;
  const now = londonNow();
  const runs = JSON.parse(gh(['run', 'list', '--workflow', 'social-live.yml', '--branch', 'main',
    '--limit', '20', '--json', 'status']));
  const socialActive = runs.some(run => ACTIVE.has(run.status));
  let assetNames = [];
  try {
    const tag = 'algoart-social-' + date.slice(0, 7);
    assetNames = JSON.parse(gh(['release', 'view', tag, '--json', 'assets'])).assets.map(a => a.name);
  } catch {
    // No monthly release yet means no slot has completed this month.
  }
  const decision = chooseCatchUp({date, now, assetNames, socialActive});
  if (decision.skip) {
    console.log('SOCIAL_CATCH_UP_SKIPPED ' + JSON.stringify({date, reason: decision.skip}));
    return;
  }
  gh(['workflow', 'run', 'social-live.yml', '--ref', 'main', '-f', 'slot=' + decision.slot]);
  console.log('SOCIAL_CATCH_UP_DISPATCHED ' + JSON.stringify({date, slot: decision.slot}));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
