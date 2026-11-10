#!/usr/bin/env node
// Conservative fast path: single-commit, isolated static-page pushes only.
// All ambiguous/multi-commit pushes and all canaries take the full gallery path.
import {appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const staticFolders = ['about/', 'press/', 'reels/', 'css/', 'fonts/', 'gallery/sculpture-lab/'];
const staticFiles = new Set([
  'index.html','favicon.svg','social-card.svg','social-card.png','robots.txt',
  'sitemap.xml','BingSiteAuth.xml','B732C1640DA947DB8E65C914FA8703EE.txt',
  '.nojekyll','test/tissue-v8/index.html',
]);
export const isIsolatedStatic = path =>
  staticFiles.has(path) || staticFolders.some(prefix => path.startsWith(prefix));

export function decidePagesBuild({eventName, before, head, parent, paths}) {
  const fallback = reason => ({rebuild: true, reason});
  if (eventName !== 'push') return fallback(`Full verification required for ${eventName || 'unknown'} trigger`);
  if (!/^[0-9a-f]{40}$/.test(before || '') || before === '0'.repeat(40))
    return fallback('No reliable push base');
  if (head !== undefined && !/^[0-9a-f]{40}$/.test(head))
    return fallback('No reliable push head');
  if (parent !== before) return fallback('Multi-commit or unresolvable push range');
  if (!Array.isArray(paths) || paths.length === 0 || paths.some(p => !p || p.includes('\n')))
    return fallback('Empty or unsafe change list');
  const unsafe = paths.filter(p => !isIsolatedStatic(p));
  if (unsafe.length) return fallback('Full gallery build for non-isolated paths: ' + unsafe.slice(0, 6).join(', '));
  return {rebuild: false, reason: `Isolated static change (${paths.length} files)`};
}

function git(...args) {
  const proc = spawnSync('git', args, {encoding: 'buffer', maxBuffer: 16 * 1024 * 1024});
  if (proc.status !== 0 || proc.error) throw Error(`git ${args[0]} failed: ${proc.stderr?.toString('utf8').slice(0, 300)}`);
  return proc.stdout;
}
export function planFromCheckout(env) {
  const eventName = env.PAGES_EVENT_NAME;
  if (eventName !== 'push') return decidePagesBuild({eventName});
  try {
    const before = env.PAGES_PUSH_BEFORE || '';
    const parent = git('rev-parse','HEAD^').toString('utf8').trim();
    const head = git('rev-parse','HEAD').toString('utf8').trim();
    if (parent !== before) return decidePagesBuild({eventName,before,head,parent});
    const changed = git('diff','--name-only','-z',before,head).toString('utf8').split('\0').filter(Boolean);
    return decidePagesBuild({eventName,before,head,parent,paths:changed});
  } catch (error) { return {rebuild:true,reason:`Conservative fallback: ${error.message}`}; }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const plan = planFromCheckout(process.env);
  console.log(`Pages build scope: ${plan.rebuild ? 'FULL' : 'STATIC'} — ${plan.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `rebuild_gallery=${plan.rebuild}\n`);
}
