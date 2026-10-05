# ALGO/ART social automation

This folder contains the automation layer for **@artalgorithm**.

## Current launch target

- Generate **10 unique artworks per day**
- Publish **3/day to Instagram**
- Publish **5/day to Threads**
- Keep 2/day as reserve pieces
- Time zone: `Europe/London`

Default planned times:

- Instagram: 09:00, 15:00, 20:30
- Threads: 08:15, 11:30, 14:30, 18:00, 21:00

These are configuration values, not hard-coded into the artwork engine.

## Safety state

Publishing is OFF by default.

Both publisher scripts immediately exit unless:

```
LIVE_PUBLISHING=true
```

Do not enable that until Meta authorization and a one-post test have succeeded.

## Dry-run generation

The generator launches the real ALGO/ART site in Chromium, passes deterministic settings through the site's existing share URL format, and captures the actual 1400×1000 artwork canvas as JPEG.

Output:

```
social-output/YYYY-MM-DD/
  10 JPEG files
  queue.json
```

The queue records the seed, settings, exact share URL, captions, alt text and intended platform slot for every piece.

## GitHub Secrets needed later

Never commit these values:

```
IG_ACCESS_TOKEN
IG_USER_ID
THREADS_ACCESS_TOKEN
THREADS_USER_ID
```

The Meta app IDs/secrets may also be needed for token exchange/refresh:

```
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
THREADS_APP_ID
THREADS_APP_SECRET
```

## Meta permissions

Instagram Login:
- `instagram_business_basic`
- `instagram_business_content_publish`

Threads:
- `threads_basic`
- `threads_content_publish`

## Media hosting

Meta fetches publishing media from a public URL. The next live-publishing step will use a rolling public GitHub Release as temporary media hosting so generated JPEGs do not bloat the main git history.
