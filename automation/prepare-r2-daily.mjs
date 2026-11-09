#!/usr/bin/env node
// Prepare a dated media inventory and its Pages overlay outside the checkout.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {validateRandomGalleryEdition} from "./confluence-edition.mjs";

const GALLERY_ORIGIN = "https://southernadd-cmyk.github.io/algoart/gallery";
const WORKER_ORIGIN = "https://proportion-piece-media.mr-adam-clement.workers.dev";
const BUCKET = "proportion-piece-media-test";
const date = process.env.R2_EDITION_DATE;
const root = path.resolve(process.env.R2_STAGE_SOURCE || ".");
const out = path.resolve(process.env.R2_STAGE_OUTPUT || "/tmp/pp-r2-daily-stage");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || date < "2026-11-09" ||
    new Date(date).toISOString().slice(0, 10) !== date) throw Error("Invalid edition date");
if (out === root || out.startsWith(root + path.sep)) throw Error("Staging directory must be OUTSIDE the checkout");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const fail = (message) => { throw Error("R2 staging: " + message); };
const matches = (text, str) => text.split(str).length - 1;
const assert = (cond, msg) => { if (!cond) fail(msg); };
const read = rel => fs.readFile(path.join(root, rel));
const readJson = async rel => JSON.parse(await fs.readFile(path.join(root, rel), "utf8"));
const write = async (rel, data) => {
  const target = path.join(out, rel);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, data);
};
const named = name => typeof name === "string" && /^[\w.-]+$/.test(name) && !name.includes("..");
const idOK = id => typeof id === "string" && /^[\w-]+$/.test(id);
const dayDir = "gallery/" + date + "/";
const [meta, textures, archive, pageRaw, indexRaw, feedRaw] = await Promise.all([
  readJson(dayDir + "meta.json"),
  readJson(dayDir + "3d/manifest.json"),
  readJson("gallery/archive.json"),
  fs.readFile(path.join(root, dayDir + "index.html"), "utf8"),
  fs.readFile(path.join(root, "gallery/index.html"), "utf8"),
  fs.readFile(path.join(root, "gallery/feed.xml"), "utf8"),
]);
assert(meta.date === date && Array.isArray(meta.entries) && meta.entries.length === meta.count, "incomplete original edition");
assert(textures.version === 1 && typeof textures.images === "object", "unrecognised tower texture manifest");
assert(meta.entries.length === Object.keys(textures.images).length, "texture/artwork count differs");
assert(archive.days.filter(x => x.date === date).length === 1, "archive missing one exact day");
validateRandomGalleryEdition(date, meta.entries);
let page = pageRaw, index = indexRaw;
const outputMeta = structuredClone(meta);
const outputTextures = structuredClone(textures);
const outputArchive = structuredClone(archive);
const assets = [];
const ids = new Set(), imageFiles = new Set();

async function asset(source, destination, role, artworkId, originalImageFile) {
  const full = dayDir + source;
  assert(!source.startsWith("/") && !source.includes("..") && source.split("/").every(x => named(x)), "invalid source path " + source);
  const data = await read(full);
  assert(data.length > 1000, "missing or tiny media " + full);
  const digest = sha(data);
  const ext = source.endsWith(".json.gz") ? "json.gz" : source.split(".").at(-1).toLowerCase();
  const mime = {jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp","json.gz":"application/gzip"}[ext];
  assert(!!mime, "unsupported media extension " + source);
  if (mime === "image/jpeg") assert(data.subarray(0,2).equals(Buffer.from([0xff,0xd8])), "JPEG signature invalid");
  if (mime === "image/webp") assert(data.subarray(0,4).toString() === "RIFF" && data.subarray(8,12).toString() === "WEBP", "WebP signature invalid");
  if (mime === "application/gzip") assert(data.subarray(0,2).equals(Buffer.from([0x1f,0x8b])), "gzip signature invalid");
  const key = "editions/" + date + "/" + destination + role + "-" + digest + "." + ext;
  assert(key.length <= 320, "oversized media key");
  return {role,artworkId,originalImageFile,sourcePath:full,key,
    url:WORKER_ORIGIN+"/"+key,sha256:digest,bytes:data.length,contentType:mime};
}
for (const [idx,entry] of meta.entries.entries()) {
  assert(idOK(entry.id) && !ids.has(entry.id), "duplicate/unsafe artwork ID");
  ids.add(entry.id);
  assert(named(entry.imageFile) && entry.imageFile.toLowerCase().endsWith(".jpg") && !imageFiles.has(entry.imageFile), "duplicate/unsafe imageFile");
  imageFiles.add(entry.imageFile);
  assert(entry.seed && entry.settings && entry.rendererVersion && entry.shareUrl, "incomplete seed/version/options");
  if (entry.material === "confluence") {
    const u = new URL(entry.shareUrl);
    assert(u.pathname === "/algoart/confluence/" && u.searchParams.has("s"), "invalid Confluence share URL");
    const state = JSON.parse(Buffer.from(u.searchParams.get("s"), "base64url"));
    assert(state.seed === entry.seed && state.artists?.length === 3, "Confluence state mismatch");
  }
  const variants = textures.images[entry.imageFile];
  assert(variants && named(variants.desktop.split("/").at(-1)) && named(variants.mobile.split("/").at(-1)), "missing texture variants");
  assert(variants.desktop.startsWith("3d/") && variants.mobile.startsWith("3d/"), "texture path must remain in edition");
  const original = await asset(entry.imageFile, entry.id + "/", "original", entry.id, entry.imageFile);
  const desktop = await asset(variants.desktop, entry.id + "/", "desktop", entry.id, entry.imageFile);
  const mobile = await asset(variants.mobile, entry.id + "/", "mobile", entry.id, entry.imageFile);
  assets.push(original,desktop,mobile);
  outputMeta.entries[idx].media = {
    original:original.url, originalSha256:original.sha256, originalBytes:original.bytes,
    desktop:desktop.url, mobile:mobile.url
  };
  outputTextures.images[entry.imageFile] = {desktop:desktop.url,mobile:mobile.url};
  // The original name is retained for all tower sculpture and manifest lookups.
  const localImg = 'src="' + entry.imageFile + '"';
  assert(matches(page, localImg) === 1, "missing/duplicate original daily gallery <img> source " + entry.imageFile);
  page = page.replace(localImg,
    'data-image-file="' + entry.imageFile + '" src="' + original.url +
    '" onerror="this.onerror=null;this.src=\'' + entry.imageFile + '\'"');
  const canonical = GALLERY_ORIGIN + "/" + date + "/" + entry.imageFile;
  // JSON-LD and OG point directly to public media; canonical HTML URLs stay put.
  page = page.split(canonical).join(original.url);
}
assert(matches(page, "data-image-file=") === meta.entries.length, "failed to preserve original filename on gallery cards");
const cover = await asset("archive-preview.jpg", "", "cover", null, null);
const sculpture = await asset("3d/sculptures.json.gz", "", "sculptures", null, null);
assets.push(cover, sculpture);
assert(assets.length === meta.entries.length * 3 + 2, "not all daily media assets collected");
outputMeta.mediaCover = cover.url;
outputMeta.mediaSculptures = sculpture.url;
const day = outputArchive.days.find(x => x.date === date);
day.mediaCover = cover.url;
day.mediaCoverBytes = cover.bytes;
const oldCoverSrc = "./" + date + "/archive-preview.jpg?v=" + date + "-" + meta.count;
assert(matches(index,oldCoverSrc) === 1, "archive index missing cover placeholder");
index = index.replace(oldCoverSrc, cover.url);
const oldLatestImage = GALLERY_ORIGIN + "/" + date + "/" + meta.entries[0].imageFile;
index = index.split(oldLatestImage).join(cover.url);
const item = new RegExp('<item>\\s*(?:(?!</item>)[\\s\\S])*?<link>' +
  GALLERY_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/' + date +
  '/</link>(?:(?!</item>)[\\s\\S])*?</item>');
assert(item.test(feedRaw), "RSS item missing for the edition");
const feed = feedRaw.replace(item, match => match.replace('</item>',
  '<enclosure url="' + cover.url + '" length="' + cover.bytes + '" type="image/jpeg"/>\n</item>'));
const publication = {
  schemaVersion:2,published:false,stageOnly:true,
  bucket:BUCKET,workerBase:WORKER_ORIGIN,date,count:meta.count,
  mediaAssets:assets,
  preservedShareUrls:meta.entries.map(({id,shareUrl,rendererVersion,seed,imageFile}) =>
    ({id,shareUrl,rendererVersion,seed,imageFile}))
};
await write("media-publication.json",JSON.stringify(publication,null,2)+"\n");
await write(dayDir+"index.html",page);
await write(dayDir+"meta.json",JSON.stringify(outputMeta,null,2)+"\n");
await write(dayDir+"3d/manifest.json",JSON.stringify(outputTextures,null,2)+"\n");
await write("gallery/index.html",index);
await write("gallery/archive.json",JSON.stringify(outputArchive,null,2)+"\n");
await write("gallery/feed.xml",feed);
console.log("R2 DAILY STAGE PASS: "+meta.count+" works, "+assets.length+" immutable media objects, "+meta.entries.length+
  " share links preserved; 2D gallery, 3D texture URLs, cover and archive index prepared OUTSIDE site.");
