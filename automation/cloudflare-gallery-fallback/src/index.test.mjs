import {test} from "node:test";
import assert from "node:assert/strict";
import {londonDate, checkAndDispatch} from "./index.mjs";

const env = {GITHUB_TOKEN: "test-token"};
const day = "2026-11-17";
const at = new Date("2026-11-17T04:30:00Z");

test("uses the London calendar day across the BST boundary", () => {
  assert.equal(londonDate(new Date("2027-06-01T23:30:00Z")), "2027-06-02");
});

test("skips a committed edition that Pages is serving, without dispatching", async () => {
  const urls = [];
  const fake = async url => { urls.push(url); return {status: 200}; };
  assert.equal(await checkAndDispatch(env, fake, at), "already-published");
  assert.equal(urls.length, 2);
  assert.ok(urls[1].startsWith("https://southernadd-cmyk.github.io/algoart/gallery/" + day + "/meta.json?"));
});

function committedButNotLive({receipt, active = false}) {
  const calls = [];
  const fetcher = async (url, opts) => {
    calls.push([url, opts.method || "GET", opts.body]);
    if (url.includes("/contents/gallery/" + day + "/meta.json")) return {status: 200};
    if (new URL(url).hostname === "southernadd-cmyk.github.io") return {status: 404};
    if (url.includes("/runs?")) return {ok: true, json: async () => ({workflow_runs: active ? [{head_branch: "main", status: "queued"}] : []})};
    if (url.includes("media-publication.json")) return {status: receipt ? 200 : 404};
    return {status: 204};
  };
  return {calls, fetcher};
}

test("redispatches R2 recovery when the committed edition is not live", async () => {
  const {calls, fetcher} = committedButNotLive({receipt: true});
  assert.equal(await checkAndDispatch(env, fetcher, at), "recovery-dispatched");
  const post = calls.filter(call => call[1] === "POST");
  assert.equal(post.length, 1);
  assert.ok(post[0][0].endsWith("/gallery-daily.yml/dispatches"));
  assert.deepEqual(JSON.parse(post[0][2]), {ref: "main", inputs: {date: day}});
});

test("redeploys Pages for a committed legacy edition that is not live", async () => {
  const {calls, fetcher} = committedButNotLive({receipt: false});
  assert.equal(await checkAndDispatch(env, fetcher, at), "pages-dispatched");
  const post = calls.filter(call => call[1] === "POST");
  assert.equal(post.length, 1);
  assert.ok(post[0][0].endsWith("/deploy-pages.yml/dispatches"));
});

test("does not stack recovery on an active run when the edition is not live", async () => {
  const {calls, fetcher} = committedButNotLive({receipt: true, active: true});
  assert.equal(await checkAndDispatch(env, fetcher, at), "already-active");
  assert.equal(calls.filter(call => call[1] === "POST").length, 0);
});

test("skips if workflow already in progress", async () => {
  const methods = [];
  const fake = async (url, opts) => {
    methods.push(opts.method || "GET");
    if (url.includes("/contents/")) return {status: 404};
    return {ok: true, json: async () => ({workflow_runs: [{head_branch: "main",status: "in_progress"}]})};
  };
  assert.equal(await checkAndDispatch(env, fake, at), "already-active");
  assert.deepEqual(methods, ["GET","GET"]);
});

test("dispatches exactly once when edition is absent and no run is active", async () => {
  const urls = [];
  const fake = async (url, opts) => {
    urls.push([url, opts.method || "GET", opts.body]);
    if (url.includes("/contents/")) return {status: 404};
    if (url.includes("/runs?")) return {ok:true, json: async () => ({workflow_runs: []})};
    return {status: 204};
  };
  assert.equal(await checkAndDispatch(env, fake, at), "dispatched");
  assert.equal(urls.length, 3);
  assert.equal(urls[2][1], "POST");
  assert.deepEqual(JSON.parse(urls[2][2]), {ref:"main"});
  assert.ok(urls[0][0].includes("gallery/" + day + "/meta.json"));
});

test("fails closed when the GitHub edition check errors", async () => {
  await assert.rejects(checkAndDispatch(env, async () => ({status: 403}), at), /HTTP 403/);
});
