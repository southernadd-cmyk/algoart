import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {rewriteDailyPageLinks, rewriteCanaryDailyLinks, PUBLIC, PREVIEW} from './rewrite-daily-links.mjs';

const action=PUBLIC+'?v=10&amp;seed=ACL-123&amp;paper=%23fff';
const confluence=PUBLIC+'confluence/?s=eyJ2IjoxLCJzZWVkIjoiQ0ZMIn0';
const html=`<!doctype html><html><head>
<link rel="canonical" href="${PUBLIC}gallery/2026-11-11/">
<meta property="og:url" content="${PUBLIC}gallery/2026-11-11/">
<script type="application/ld+json">{"url":"${action}"}</script>
</head><body>
<a class="art-image-link" href="${action}"><img src="a.jpg"></a>
<a class="remix" href="${action}">Open this drawing →</a>
<a class="art-image-link" href="${confluence}"><img src="b.jpg"></a>
<a class="remix" href="${confluence}">Open this drawing →</a>
<a href="../visit/">Walk the floor in 3D</a>
</body></html>`;

test('rewrite BOTH artwork/image links and Confluence links without altering share query or base64url state',()=>{
  const result=rewriteDailyPageLinks(html);
  assert.equal(result.changed,4);
  assert.ok(result.html.includes('<a class="remix" href="'+PREVIEW+'?v=10&amp;seed=ACL-123&amp;paper=%23fff">'));
  assert.ok(result.html.includes('<a class="art-image-link" href="'+PREVIEW+'confluence/?s=eyJ2IjoxLCJzZWVkIjoiQ0ZMIn0">'));
  assert.equal(rewriteDailyPageLinks(result.html).changed,0,'overlay must be idempotent');
});
test('canonical, OG metadata, JSON-LD, paths and production origin are unchanged',()=>{
  const transformed=rewriteDailyPageLinks(html).html;
  assert.ok(transformed.includes('<link rel="canonical" href="'+PUBLIC+'gallery/2026-11-11/">'));
  assert.ok(transformed.includes('<meta property="og:url" content="'+PUBLIC+'gallery/2026-11-11/">'));
  assert.ok(transformed.includes('<script type="application/ld+json">{"url":"'+action+'"}'));
  assert.ok(transformed.includes('<a href="../visit/">Walk the floor in 3D</a>'));
});
test('changes only copied Cloudflare files, never hard-linked Pages or canonical archive source',async()=>{
  const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'pp-preview-links-'));
  try{
    const pages=path.join(scratch,'_site','gallery','2026-11-11');
    const copied=path.join(scratch,'_cf_assets','algoart','gallery','2026-11-11');
    await fs.mkdir(pages,{recursive:true});await fs.mkdir(copied,{recursive:true});
    const src=path.join(pages,'index.html'),dst=path.join(copied,'index.html');
    await fs.writeFile(src,html);await fs.link(src,dst);
    const result=await rewriteCanaryDailyLinks(path.join(scratch,'_cf_assets','algoart','gallery'));
    assert.deepEqual(result,{files:1,anchors:4});
    assert.equal(await fs.readFile(src,'utf8'),html,'_site must remain byte-for-byte original');
    const copiedHtml=await fs.readFile(dst,'utf8');
    assert.ok(copiedHtml.includes(PREVIEW+'?v=10&amp;seed=ACL-123'));
    assert.equal(rewriteDailyPageLinks(copiedHtml).changed,0);
  }finally{await fs.rm(scratch,{recursive:true,force:true});}
});
test('refuses to rewrite source gallery or Pages trees',async()=>{
  await assert.rejects(rewriteCanaryDailyLinks('gallery'),/ONLY/);
  await assert.rejects(rewriteCanaryDailyLinks('_site/gallery'),/ONLY/);
});
