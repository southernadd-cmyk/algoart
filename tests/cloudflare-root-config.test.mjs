import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
assert.match(config,/main = "cloudflare\/social-preview\/src\/worker\.mjs"/);
assert.match(config,/name = "proportion-piece-social"/);
assert.match(config,/binding = "PREVIEW_KV"/);
assert.match(config,/7dc02116a78744ad959cce0cc8292b42/);
assert.doesNotMatch(config,/REPLACE_WITH/);
console.log('PASS Cloudflare root deploy targets social Worker, not website');
