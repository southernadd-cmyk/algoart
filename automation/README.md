# ALGO/ART social automation

This folder contains the live automation layer for **@artalgorithm** on Instagram and Threads.

## Live cadence

- Generate **5 unique artworks per day**
- Publish the same featured artwork to **Instagram and Threads 3 times per day**
- Keep **2 reserve artworks** per day
- Time zone: `Europe/London`

Live posting times:

- 09:00
- 15:00
- 20:30

The workflow accounts for GMT/BST and only publishes when the local London slot matches.

## Live status

Publishing is now live through:

```
.github/workflows/social-live.yml
```

The first controlled live run completed successfully on both Instagram and Threads before the recurring schedule was enabled.

The lower-level publisher scripts still refuse to post unless:

```
LIVE_PUBLISHING=true
```

The live workflow sets this explicitly. Dry-run and verification workflows do not.

## Duplicate protection

A rolling public GitHub Release is used for temporary media hosting.

For each date / slot / platform, the live workflow writes a completion marker after a successful publish. If a workflow is retried:

- an already-successful Instagram post is not published twice
- an already-successful Threads post is not published twice
- only the missing platform is retried

## Artwork generation

The generator launches the real ALGO/ART site in Chromium, passes deterministic settings through the site's share URL format, and captures the actual 1400×1000 artwork canvas as JPEG.

Output:

```
social-output/YYYY-MM-DD/
  5 JPEG files
  queue.json
```

Slots 1, 3 and 5 are featured posts. Slots 2 and 4 are reserves.

The queue records the seed, settings, exact share URL, captions, alt text and intended platform slot for every piece.

## GitHub Secrets

These are configured in GitHub Actions and must never be committed:

```
IG_ACCESS_TOKEN
IG_USER_ID
THREADS_ACCESS_TOKEN
THREADS_USER_ID
```

## Meta permissions

Instagram Login:
- `instagram_business_basic`
- `instagram_business_content_publish`

Threads:
- `threads_basic`
- `threads_content_publish`

## Verification

Read-only verification workflows are retained for both platforms:

```
.github/workflows/verify-instagram.yml
.github/workflows/verify-threads.yml
```

They verify that the tokens belong to **@artalgorithm** without publishing anything.


## Pinterest

Pinterest support is built into the live workflow but is **off by default** so it cannot affect the working Instagram/Threads automation.

Required GitHub Actions secrets:

```
PINTEREST_ACCESS_TOKEN
PINTEREST_BOARD_ID
```

Required repository variable:

```
PINTEREST_ENABLED=true
```

Before enabling it, run:

```
.github/workflows/verify-pinterest.yml
```

That verifies the token and configured board without creating a Pin.

Once enabled, each featured daily artwork is also published to Pinterest with:
- the generated artwork image
- ALGO/ART title/description metadata
- alt text
- a direct link to that exact artwork state in the generator
- duplicate protection using the same rolling GitHub Release markers as Instagram/Threads


## Bluesky publishing

The live publisher supports the official ALGO/ART Bluesky account at `artalgorithm.bsky.social`.

To enable it, create a Bluesky app password for the account and add it to the GitHub repository as the Actions secret `BLUESKY_APP_PASSWORD`. The workflow automatically detects whether the secret exists; if it is absent, Bluesky is skipped without affecting Instagram, Threads, Pinterest, gallery generation, or Pages deployment.

Bluesky uses the same London publishing slots and selected artwork as Instagram and Threads. Each successful Bluesky post creates its own release marker (`done-YYYY-MM-DD-slotN-bluesky.txt`) so a retried workflow cannot knowingly publish the same slot twice.
