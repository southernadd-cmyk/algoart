#!/usr/bin/env bash
# Isolated Cloudflare website canary build. Used by GitHub preflight and Workers Builds.
set -euo pipefail
npm ci
npm run gallery:bundle
npm run gallery:bundle:phi
node --check gallery/visit/gallery-bundle.js
node --check gallery/visit/gallery-phi-bundle.js
node automation/validate-phi-archive.mjs
node --test tests/gallery-public-launch.test.mjs
mkdir -p _site
for dir in about confluence css fonts js gallery press reels; do
  if [[ -d "$dir" ]]; then cp -a "$dir" "_site/$dir"; fi
done
mkdir -p _site/preview/tissue-v8
cp test/tissue-v8/index.html _site/preview/tissue-v8/index.html
find . -maxdepth 1 -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.json' -o -name '*.webmanifest' -o -name '*.xml' -o -name '*.txt' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.svg' -o -name '*.ico' -o -name '.nojekyll' \) -exec cp -t _site -- {} +
find _site -type d \( -name node_modules -o -name .git -o -name .github -o -name tests -o -name automation -o -name .chat-v2-staging \) -prune -exec rm -rf -- {} +
test -s _site/index.html
test -s _site/confluence/index.html
test -s _site/gallery/visit/gallery-phi-bundle.js
test -s _site/gallery/sculpture-lab/lab-v2.mjs
test -s _site/preview/tissue-v8/index.html
test ! -e _site/test
python3 - <<'PY'
from pathlib import Path
files = [p for p in Path('_site').rglob('*') if p.is_file()]
oversized = [str(p) for p in files if p.stat().st_size > 25 * 1024 * 1024]
if len(files) > 20000 or oversized:
    raise SystemExit(f'Exceeded Cloudflare static asset limits: {len(files)} files; oversized {oversized}')
print(f'CANARY STATIC PARITY: {len(files)} files, {sum(p.stat().st_size for p in files):,} bytes; all under Cloudflare file limits')
PY
