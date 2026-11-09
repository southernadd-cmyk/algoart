#!/usr/bin/env python3
"""Exercise the ACTUAL published phi-tower JavaScript through browser-only R2 URL injection.

The script reads the exact 50-object one-edition rehearsal manifest. It does not
change any deployed HTML, texture manifests, bundles, image bytes, or GitHub Pages.
On the Playwright browser only, it substitutes the original gallery HTML's image
src and 3d/manifest.json texture variant values with equivalent public R2 URLs.
The real, unmodified production gallery-phi-bundle.js then resolves and loads
those sources into the 3D world.

Requires r2-one-edition-rehearsal.py stage first and cleanup afterward.
"""
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

DAY = "2026-11-09"
ORIGIN = "https://southernadd-cmyk.github.io"
GALLERY = f"{ORIGIN}/algoart/gallery/{DAY}/"
TOWER = f"{ORIGIN}/algoart/gallery/visit/?debug=1&date={DAY}"
MANIFEST = Path(os.getenv("R2_EDITION_REHEARSAL_MANIFEST",
                          "/tmp/pp-edition-rehearsal/manifest.json"))
REPORT = Path(os.getenv("R2_TOWER_INTEGRATION_REPORT",
                        "/tmp/pp-edition-rehearsal/tower-integration.json"))


def require(condition, message):
    if not condition:
        raise ValueError(message)


async def run():
    original = json.loads(MANIFEST.read_text("utf8"))
    require(original.get("bucket") == "proportion-piece-media-test", "Wrong R2 bucket")
    records = original.get("assets", [])
    require(len(records) == 50, "Not a complete 50-object edition manifest")
    sources = {x["sourcePath"]: x["url"] for x in records}
    artwork_records = [x for x in records if x["role"] == "original"]
    textures = [x for x in records if x["role"] == "texture"]
    require(len(artwork_records) == 16 and len(textures) == 32, "Bad published edition inventory")
    require(all(urlsplit(x["url"]).hostname.endswith(".r2.dev") for x in records),
            "Test-only r2.dev origins required")
    page_url = GALLERY
    json_url = GALLERY + "3d/manifest.json"
    report = {"run": os.getenv("GITHUB_RUN_ID"), "day": DAY,
              "productionJSUnmodified": True, "productionGalleryHTMLUnmodified": True,
              "production3DManifestUnmodified": True, "browsers": [], "errors": []}

    async with async_playwright() as playwright:
        # Check the actual production tower with full support. Firefox headless
        # lacks a usable GPU in GitHub Actions; its image CORS was already
        # separately verified in the edition rehearsal.
        for browser_name in ("chromium", "webkit"):
            browser = await getattr(playwright, browser_name).launch(
                headless=True, timeout=60000)
            try:
                page = await browser.new_page(viewport={"width": 1440, "height": 900},
                                             reduced_motion="reduce")
                request_failures = []
                seen_r2 = []
                js_errors = []
                page.on("requestfailed", lambda req: request_failures.append(
                    {"url": req.url, "reason": req.failure}))
                page.on("pageerror", lambda error: js_errors.append(str(error)))

                async def watch_request(request):
                    if request.url.startswith(original["baseURL"] + "/"):
                        seen_r2.append(request.url)

                page.on("request", watch_request)

                async def rewrite_edition(route):
                    # Fetch genuine production HTML; replace only art-card src
                    # in the browser response, preserving links, captions,
                    # card IDs, original filenames and all page scripts.
                    response = await route.fetch(timeout=45000)
                    require(response.ok, "Published gallery HTML unavailable")
                    html = await response.text()
                    edits = 0
                    for item in artwork_records:
                        name = item["originalImageFile"]
                        marker = 'src="' + name + '"'
                        require(html.count(marker) == 1,
                                "Published gallery markup changed for " + name)
                        html = html.replace(marker, 'src="' + item["url"] + '"')
                        edits += 1
                    require(edits == 16, "Incomplete gallery in-memory substitution")
                    await route.fulfill(response=response, body=html)

                async def rewrite_texture_manifest(route):
                    response = await route.fetch(timeout=45000)
                    require(response.ok, "Published 3d/manifest.json unavailable")
                    manifest = await response.json()
                    require(manifest.get("version") == 1 and
                            len(manifest.get("images", {})) == 16,
                            "Published tower texture manifest changed")
                    edits = 0
                    for name, sizes in manifest["images"].items():
                        for kind in ("desktop", "mobile"):
                            source_path = f"gallery/{DAY}/{sizes[kind]}"
                            require(source_path in sources,
                                    "Missing matching R2 texture: " + source_path)
                            sizes[kind] = sources[source_path]
                            edits += 1
                    require(edits == 32, "Incomplete tower variant substitution")
                    await route.fulfill(response=response,
                                        body=json.dumps(manifest),
                                        content_type="application/json")

                await page.route(page_url, rewrite_edition)
                await page.route(json_url, rewrite_texture_manifest)
                response = await page.goto(TOWER, wait_until="domcontentloaded",
                                           timeout=60000)
                require(response and response.status == 200,
                        "Actual live tower page unavailable")

                # The production bundle honours ?date= and loads its own
                # gallery HTML, 3D texture manifest, art and sculpture pipeline.
                await page.wait_for_function(
                    """day => {
                       const s=window.__phiFullEngine;
                       return s && s.date===day && s.artworks===16 && s.paintings>0;
                    }""", DAY, timeout=150000)
                await page.wait_for_function(
                    """() => {
                       const s=window.__phiFullEngine;
                       return s && s.paintingsLoaded>=s.paintings;
                    }""", timeout=150000)
                await page.wait_for_timeout(1200)
                state = await page.evaluate("""() => {
                  const s=window.__phiFullEngine||{};
                  return {date:s.date,artworks:s.artworks,paintings:s.paintings,
                    sculptures:s.sculptures,paintingsLoaded:s.paintingsLoaded,
                    unplaced:s.unplaced, error:document.querySelector('#error')?.textContent,
                    bannerVisible:!document.querySelector('#error')?.hidden,
                    launchEnabled:!document.querySelector('#enter')?.disabled,
                    debugAvailable:typeof window.__phiEditorialCapture?.edition==='function'};
                }""")
                require(state["paintingsLoaded"] == state["paintings"],
                        "Actual production wall paintings did not load")
                require(state["unplaced"] == 0, "Tower floor has unplaced works")
                require(not state["bannerVisible"], "Actual tower displayed load failure")
                require(state["launchEnabled"], "Actual tower launch was not prepared")

                normalized = [u for u in set(seen_r2) if
                              "/gallery/" + DAY + "/3d/" in u]
                require(normalized,
                        "No actual tower 3D texture fetched from the R2 origin")
                # Report only filenames, not full URLs or temporary credentials.
                distinct = sorted({urlsplit(url).path.rsplit("/", 1)[-1]
                                  for url in normalized})
                result = {"browser": browser_name, **state,
                          "towerR2TextureRequests": len(distinct),
                          "towerR2TextureFiles": distinct,
                          "jsErrorCount": len(js_errors),
                          "requestFailureCount": len(request_failures),
                          "r2RequestFailures": [x for x in request_failures if
                                                ".r2.dev/" in x["url"]]}
                require(not result["r2RequestFailures"],
                        "Actual tower had a failed R2 texture request")
                require(not js_errors, "Actual tower page crashed: " + js_errors[0])
                report["browsers"].append(result)
                print("ACTUAL TOWER:", browser_name, "16 original studies,",
                      state["paintingsLoaded"], "/", state["paintings"],
                      "paintings loaded,", len(distinct),
                      "distinct real R2 WebP tower texture requests")
            finally:
                await browser.close()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf8")
    print("ACTUAL PHI TOWER INTEGRATION PASS: production loader exercised, 2 browsers")


if __name__ == "__main__":
    asyncio.run(run())
