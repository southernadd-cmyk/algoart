import {test} from "node:test";
import assert from "node:assert/strict";
import {londonDate, checkAndDispatch} from "./index.mjs";

const env = {GITHUB_TOKEN: "test-token"};
const day = "2026-11-17";
const at = new Date("2026-11-17T04:30:00Z");

test("uses the London calendar day across the BST boundary", () => {
  assert.equal(londonDate(new Date("2027-06-01T23:30:00Z")), "2027-06-02");
});

test("skips published edition without looking up or dispatching runs", async () => {
  let calls = 0;
  const fake = async () => { calls++; return {status: 200}; };
  assert.equal(await checkAndDispatch(env, fake, at), "already-published");
  assert.equal(calls, 1);
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
