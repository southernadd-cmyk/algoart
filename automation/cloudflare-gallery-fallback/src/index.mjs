// Cron-only independent recovery for PROPORTION PIECE.
// Deploy separately from the artwork/R2 Worker. No public HTTP handler.
const REPO = "southernadd-cmyk/algoart";
const WORKFLOW = "gallery-daily.yml";
const BASE = "https://api.github.com/repos/" + REPO;
const ACTIVE = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);

export function londonDate(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const get = type => parts.find(part => part.type === type)?.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

export async function checkAndDispatch(env, fetcher = fetch, at = new Date()) {
  if (!env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN Worker secret");
  const day = londonDate(at);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + env.GITHUB_TOKEN,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "proportion-piece-gallery-fallback",
  };

  // A published edition is immutable. Never start another build for it.
  const edition = await fetcher(BASE + "/contents/gallery/" + day + "/meta.json?ref=main", {headers});
  if (edition.status === 200) {
    console.log("Gallery " + day + " already exists; no dispatch");
    return "already-published";
  }
  if (edition.status !== 404) {
    throw new Error("Cannot check current gallery: HTTP " + edition.status);
  }

  // An active GitHub run is already handling this date (or blocking it in the
  // workflow-wide concurrency group). Avoid adding another queued run.
  const running = await fetcher(BASE + "/actions/workflows/" + WORKFLOW + "/runs?per_page=100", {headers});
  if (!running.ok) throw new Error("Cannot check active gallery runs: HTTP " + running.status);
  const data = await running.json();
  if (!Array.isArray(data.workflow_runs)) throw new Error("Malformed Actions response");
  if (data.workflow_runs.some(run => run.head_branch === "main" && ACTIVE.has(run.status))) {
    console.log("Gallery workflow is already active; no dispatch");
    return "already-active";
  }

  // workflow_dispatch does not commit a trigger file or modify main.
  const dispatched = await fetcher(BASE + "/actions/workflows/" + WORKFLOW + "/dispatches", {
    method: "POST",
    headers: {...headers, "Content-Type": "application/json"},
    body: JSON.stringify({ref: "main"}),
  });
  if (dispatched.status !== 204) {
    throw new Error("Gallery workflow_dispatch failed: HTTP " + dispatched.status);
  }
  console.log("Dispatched gallery recovery for " + day);
  return "dispatched";
}

export default {
  scheduled(_event, env, ctx) {
    ctx.waitUntil(checkAndDispatch(env));
  },
};
