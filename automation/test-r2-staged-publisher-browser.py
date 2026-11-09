#!/usr/bin/env python3
"""Exercise actual 2D gallery AND compiled staging PHI tower against R2 media.

Browser-only route substitution; NEVER changes public GitHub Pages or Worker.
Requires prepared staging HTML+manifest and verified temporary R2 media uploads.
"""
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

DATE="2026-11-09"
ORIGIN="https://southernadd-cmyk.github.io"
DAY_URL=ORIGIN+"/algoart/gallery/"+DATE+"/"
INDEX_URL=ORIGIN+"/algoart/gallery/"
TOWER_URL=ORIGIN+"/algoart/gallery/visit/?debug=1&date="+DATE
WORKER="https://proportion-piece-media.mr-adam-clement.workers.dev"
DIR=Path(os.getenv("R2_STAGE_OUTPUT","/tmp/pp-r2-daily-stage"))
BUNDLE=Path("gallery/visit/gallery-phi-bundle.js")
REPORT=DIR/"browser-integration.json"


def check(ok,message):
    if not ok:raise RuntimeError(message)


async def run():
    meta=json.loads((DIR/"gallery"/DATE/"meta.json").read_text())
    manifest=json.loads((DIR/"media-publication.json").read_text())
    variants=json.loads((DIR/"gallery"/DATE/"3d"/"manifest.json").read_text())
    day=(DIR/"gallery"/DATE/"index.html").read_text()
    listing=(DIR/"gallery/index.html").read_text()
    check(BUNDLE.is_file() and BUNDLE.stat().st_size>100000,"Compiled staging tower bundle missing")
    check(meta["count"]==16 and len(variants["images"])==16,"Incomplete staged edition")
    check(manifest["published"] is False and manifest["stageOnly"] is True,"Refuse to test published manifest")
    report={"date":DATE,"root":WORKER,"browser":[],"productionFilesChanged":False,
            "legacyShareLinksPreserved":True,"requiresLiveApproval":True}
    async with async_playwright() as p:
        for name in ("chromium","webkit"):
            browser=await getattr(p,name).launch(headless=True,timeout=70000)
            try:
                context=await browser.new_context(viewport={"width":1440,"height":900})
                day_route=lambda route: route.fulfill(status=200,body=day,content_type="text/html; charset=utf-8")
                index_route=lambda route: route.fulfill(status=200,body=listing,content_type="text/html; charset=utf-8")
                manifest_route=lambda route: route.fulfill(status=200,
                  body=json.dumps(variants),content_type="application/json")
                bundle_route=lambda route: route.fulfill(status=200,
                  body=BUNDLE.read_bytes(),content_type="application/javascript")
                await context.route(DAY_URL,day_route)
                await context.route(INDEX_URL,index_route)
                await context.route(DAY_URL+"3d/manifest.json",manifest_route)
                await context.route("**/gallery/visit/gallery-phi-bundle.js*",bundle_route)
                page=await context.new_page()
                errors=[]
                failed=[]
                r2_webps=[]
                page.on("pageerror",lambda e: errors.append(str(e)))
                page.on("requestfailed",lambda req: failed.append({"url":req.url,"why":req.failure}))
                def watch(req):
                    if req.url.startswith(WORKER+"/") and ".webp" in req.url:
                        r2_webps.append(req.url)
                page.on("request",watch)

                res=await page.goto(DAY_URL,wait_until="domcontentloaded",timeout=60000)
                check(res and res.status==200,"Staged 2D daily page unreachable")
                gallery=await page.evaluate("""async(expected) => {
                   const cards=[...document.querySelectorAll('article.art-card')];
                   if(cards.length!==expected.length)throw Error('Wrong card count '+cards.length);
                   for(let i=0;i<cards.length;i++){
                     const card=cards[i],e=expected[i];
                     const img=card.querySelector('img');
                     const href=card.querySelector('a.remix')?.href;
                     if(img.dataset.imageFile!==e.imageFile)
                       throw Error('Missing original filename '+e.id);
                     if(img.src!==e.media.original)
                       throw Error('Wrong R2 source '+e.id);
                     if(href!==e.shareUrl)
                       throw Error('Lost original share state '+e.id);
                     // WebKit sometimes aborts decode() on in-flight lazy images.
                     // Probe the exact original URL with a fresh eager image.
                     const probe=new Image();
                     probe.crossOrigin='anonymous';probe.loading='eager';
                     probe.src=img.src;
                     try{await probe.decode();}
                     catch(error){throw Error('Worker image decode '+e.id+': '+error.message);}
                     if(probe.naturalWidth<100||probe.naturalHeight<100)
                       throw Error('Failed image decode '+e.id);
                   }
                   return {cards:cards.length,complete:true};
                }""",meta["entries"])
                check(gallery["cards"]==16,"Not all 2D cards rendered")
                await page.goto(INDEX_URL,wait_until="domcontentloaded",timeout=60000)
                cover=await page.evaluate("""async () => {
                  const img=[...document.querySelectorAll('.day-card img')]
                    .find(x=>x.src.includes('/editions/2026-11-09/cover-'));
                  if(!img)throw Error('Missing R2 cover on archive index');
                   const probe=new Image();
                   probe.crossOrigin='anonymous';probe.loading='eager';
                   probe.src=img.src;
                   await probe.decode();
                   return {width:probe.naturalWidth,height:probe.naturalHeight};
                }""")
                check(cover["width"]>=400 and cover["height"]>=200,"Invalid archive mosaic")
                res=await page.goto(TOWER_URL,wait_until="domcontentloaded",timeout=60000)
                check(res and res.status==200,"Real phi tower page unreachable")
                await page.wait_for_function("""date=>{
                  const s=window.__phiFullEngine;
                  return s&&s.date===date&&s.artworks===16&&s.paintings>0;
                }""",arg=DATE,timeout=130000)
                await page.wait_for_function("""()=>{
                  const s=window.__phiFullEngine;
                  return s && s.paintingsLoaded>=s.paintings &&
                         document.getElementById('enter')?.disabled===false;
                }""",timeout=130000)
                state=await page.evaluate("""()=>{
                  const s=window.__phiFullEngine;
                  return {date:s.date,artworks:s.artworks,paintings:s.paintings,
                     paintingsLoaded:s.paintingsLoaded,sculptures:s.sculptures,
                     unplaced:s.unplaced,launch:!document.getElementById('enter')?.disabled,
                     errorVisible:!document.getElementById('error')?.hidden}
                }""")
                check(state["unplaced"]==0 and state["launch"] and not state["errorVisible"],
                      "Actual staged tower did not prepare gallery floor")
                webps=set(r2_webps)
                check(len(webps)>=8,"Actual phi tower did not fetch expected R2 WebP variants")
                check(not [f for f in failed if f["url"].startswith(WORKER)],
                      "Actual tower browser had failed Worker media requests")
                check(not errors,"Browser pageerror: "+str(errors[:3]))
                report["browser"].append({
                    "name":name,"dailyArtworks":gallery["cards"],"archiveCover":cover,
                    "tower":state,"uniqueR2WebPRequests":len(webps),"jsErrors":len(errors),
                    "r2RequestFailures":0
                })
                print("STAGED REAL TOWER PASS:",name,"gallery",gallery["cards"],"R2 WebP",len(webps),
                      "paintings",state["paintingsLoaded"],"/",state["paintings"])
            finally:await browser.close()
    REPORT.write_text(json.dumps(report,indent=2))
    print("COMPLETE STAGED R2 PUBLISHER PASS: 2D gallery, 3D tower, cover and share URLs, Chromium+WebKit")

if __name__=="__main__":
    asyncio.run(run())
