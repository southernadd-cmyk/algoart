#!/usr/bin/env node
// Preview-only dated gallery link overlay; NEVER alter public archive share URLs.
// Changes HTML anchors inside the Cloudflare site's copied asset tree, not the
// source gallery, Pages _site, archive metadata, JSON-LD, or canonical links.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const PUBLIC = 'https://southernadd-cmyk.github.io/algoart/';
export const PREVIEW = 'https://proportion-piece-web-canary.mr-adam-clement.workers.dev/algoart/';
export const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

export function rewriteDailyPageLinks(source) {
  let changed = 0;
  const html = source.replace(/<a\b[^>]*>/gi, tag => tag.replace(
    /\bhref=(["'])https:\/\/southernadd-cmyk\.github\.io\/algoart\/(\?[^"']*|confluence\/\?[^"']*)\1/gi,
    (_whole, quote, suffix) => {
      changed++;
      return `href=${quote}${PREVIEW}${suffix}${quote}`;
    }
  ));
  return {html, changed};
}

export async function rewriteCanaryDailyLinks(assetRoot) {
  const root = path.resolve(assetRoot);
  if (!root.endsWith(path.join('_cf_assets', 'algoart', 'gallery'))) {
    throw new Error('Preview link overlay can ONLY run on _cf_assets/algoart/gallery');
  }
  let files = 0, anchors = 0;
  for (const entry of await fs.readdir(root, {withFileTypes: true})) {
    if (!entry.isDirectory() || !DATE_DIR.test(entry.name)) continue;
    const originalPath = path.join(root, entry.name, 'index.html');
    let source;
    try { source = await fs.readFile(originalPath, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const {html, changed} = rewriteDailyPageLinks(source);
    if (!changed) continue;
    // cp -al hard-links this preview tree to _site. Never truncate the inode:
    // write to a new file and rename atomically, breaking the hard link first.
    const temp = originalPath + '.preview-link-overlay.tmp';
    try {
      await fs.writeFile(temp, html, {flag:'wx'});
      await fs.rename(temp, originalPath);
    } catch (error) {
      await fs.rm(temp, {force:true});
      throw error;
    }
    files++; anchors += changed;
  }
  console.log(`CANARY_DAILY_EDITOR_LINKS: ${files} edition pages, ${anchors} anchors now stay on preview; canonical/JSON-LD/source share URLs intact`);
  return {files, anchors};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = process.argv[2];
  if (!root) throw Error('Usage: node cloudflare/web-canary/rewrite-daily-links.mjs _cf_assets/algoart/gallery');
  await rewriteCanaryDailyLinks(root);
}
