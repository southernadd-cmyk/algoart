import assert from "node:assert/strict";
import { test } from "node:test";
import gateway from "../cloudflare/media-read-only/src/worker.mjs";

const ORIGIN = "https://southernadd-cmyk.github.io";
const URL_BASE = "https://proportion-piece-media.example.workers.dev/";
const SHA = "a".repeat(64);
const KEY = "editions/2026-11-09/2026-11-09-G01/original-" + SHA + ".jpg";
const TEXTURE = "editions/2026-11-09/2026-11-09-G01/desktop-" + SHA + ".webp";
const COVER = "editions/2026-11-09/cover-" + SHA + ".jpg";
const SCULPTURES = "editions/2026-11-09/sculptures-" + SHA + ".json.gz";
const body = Uint8Array.from([255,216,255,224,1,2,3,4]);
function mockEnvironment() {
  const calls = [];
  const assets = new Map([KEY, TEXTURE, COVER, SCULPTURES].map(key=>[key,body]));
  const getObject = key => {
    const bytes=assets.get(key);
    if(!bytes)return null;
    return {
      size: bytes.byteLength,
      httpEtag: '"etag-verified"',
      body: new Response(bytes).body,
    };
  };
  return {
    calls,
    env: {
      MEDIA: {
        async get(key) {calls.push(["get",key]);return getObject(key);},
        async head(key) {calls.push(["head",key]);return getObject(key);},
      },
    },
  };
}
function request(path,method="GET",origin=ORIGIN,extra={}) {
  return new Request(URL_BASE+path,{
    method,headers:{Origin:origin,...extra},
  });
}
test("GET streams exact immutable JPEG with R2 byte length and fixed CORS",async()=>{
  const {env,calls}=mockEnvironment();
  const r=await gateway.fetch(request(KEY),env);
  assert.equal(r.status,200);
  assert.equal(r.headers.get("Content-Type"),"image/jpeg");
  assert.equal(r.headers.get("Content-Length"),String(body.byteLength));
  assert.equal(r.headers.get("ETag"),'"etag-verified"');
  assert.equal(r.headers.get("Access-Control-Allow-Origin"),ORIGIN);
  assert.equal(r.headers.get("Cache-Control"),"public, max-age=31536000, immutable");
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[...body]);
  assert.deepEqual(calls,[["get",KEY]]);
});
test("HEAD uses R2 metadata without fetching body",async()=>{
  const {env,calls}=mockEnvironment();
  const r=await gateway.fetch(request(TEXTURE,"HEAD"),env);
  assert.equal(r.status,200);
  assert.equal(r.headers.get("Content-Type"),"image/webp");
  assert.equal(r.headers.get("Content-Length"),String(body.byteLength));
  assert.equal((await r.arrayBuffer()).byteLength,0);
  assert.deepEqual(calls,[["head",TEXTURE]]);
});
test("Cover JPEG and sculpture gzip have exact allowed MIME",async()=>{
  for(const [key,type] of [[COVER,"image/jpeg"],[SCULPTURES,"application/gzip"]]){
    const {env}=mockEnvironment();
    const r=await gateway.fetch(request(key),env);
    assert.equal(r.status,200);
    assert.equal(r.headers.get("Content-Type"),type);
  }
});
test("Only immutable SHA-addressed edition keys can be read",async()=>{
  const {env,calls}=mockEnvironment();
  const invalid = [
    "",KEY.replace(SHA,"x".repeat(64)),
    KEY.replace("editions/","archive/"),
    "gallery/2026-11-09/2026-11-09-G01.jpg",
    "editions/2026-11-09/bad-file.jpg",
    "editions/2026-11-09/../private/secret",
    "editions/2026-11-09/2026-11-09-G01/original-" +SHA+".js",
    "editions/2026-11-09/2026-11-09-G01/original-" +SHA+".jpg?download=1",
    "editions/2026-11-09/2026-11-09-G01/desktop-" +SHA+".jpg",
    "editions/2026-11-09/cover-" +SHA+".webp",
  ];
  for(const key of invalid){
    const r=await gateway.fetch(request(key),env);
    assert.equal(r.status,404,"should reject "+key);
    assert.equal(r.headers.get("Cache-Control"),"no-store");
  }
  assert.equal(calls.length,0);
});
test("Missing objects fail closed and do not get cached",async()=>{
  const {env}=mockEnvironment();
  const r=await gateway.fetch(request(KEY.replace(SHA,"b".repeat(64))),env);
  assert.equal(r.status,404);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
});
test("PUT, DELETE and POST are always refused with no storage access",async()=>{
  const {env,calls}=mockEnvironment();
  for(const method of ["PUT","DELETE","POST"]){
    const r=await gateway.fetch(request(KEY,method),env);
    assert.equal(r.status,405);
    assert.equal(r.headers.get("Allow"),"GET, HEAD, OPTIONS");
  }
  assert.equal(calls.length,0);
});
test("CORS preflight grants only intended GitHub Pages origin and GET/HEAD",async()=>{
  const {env,calls}=mockEnvironment();
  const good=await gateway.fetch(request(KEY,"OPTIONS",ORIGIN,
        {"Access-Control-Request-Method":"GET"}),env);
  assert.equal(good.status,204);
  assert.equal(good.headers.get("Access-Control-Allow-Origin"),ORIGIN);
  const badOrigin=await gateway.fetch(request(KEY,"OPTIONS","https://elsewhere.example",
        {"Access-Control-Request-Method":"GET"}),env);
  assert.equal(badOrigin.status,403);
  const badMethod=await gateway.fetch(request(KEY,"OPTIONS",ORIGIN,
        {"Access-Control-Request-Method":"PUT"}),env);
  assert.equal(badMethod.status,403);
  assert.equal(calls.length,0);
});
test("Cross-site reads never grant an unrelated origin",async()=>{
  const {env}=mockEnvironment();
  const r=await gateway.fetch(request(KEY,"GET","https://unrelated.example"),env);
  assert.equal(r.status,200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"),ORIGIN);
});
test("Missing R2 binding fails closed, never falls back to backup",async()=>{
  const r=await gateway.fetch(request(KEY),{});
  assert.equal(r.status,503);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
});
test("R2 retrieval failure is a no-store service error",async()=>{
  const r=await gateway.fetch(request(KEY),{MEDIA:{
    get(){throw new Error("simulated outage");},head(){throw new Error("simulated outage");},
  }});
  assert.equal(r.status,503);
  assert.equal(r.headers.get("Cache-Control"),"no-store");
});
