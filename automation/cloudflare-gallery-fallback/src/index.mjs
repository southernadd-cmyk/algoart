// Cron-only independent recovery for PROPORTION PIECE.
// Deploy separately from the artwork/R2 Worker. No public HTTP handler.
const REPO = "southernadd-cmyk/algoart";
const WORKFLOW = "gallery-daily.yml";
const PAGES_WORKFLOW = "deploy-pages.yml";
const BASE = "https://api.github.com/repos/" + REPO;
const SITE = "https://southernadd-cmyk.github.io/algoart/gallery/";
const ACTIVE = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);

export function londonDate(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const get = type => parts.find(part => part.type === type)?.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

async function anyActive(fetcher, headers, workflow) {
  const running = await fetcher(BASE + "/actions/workflows/" + workflow + "/runs?per_page=100", {headers});
  if (!running.ok) throw new Error("Cannot check active " + workflow + " runs: HTTP " + running.status);
  const data = await running.json();
  if (!Array.isArray(data.workflow_runs)) throw new Error("Malformed Actions response");
  return data.workflow_runs.some(run => run.head_branch === "main" && ACTIVE.has(run.status));
}

async function dispatch(fetcher, headers, workflow, body) {
  const dispatched = await fetcher(BASE + "/actions/workflows/" + workflow + "/dispatches", {
    method: "POST",
    headers: {...headers, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  if (dispatched.status !== 204) {
    throw new Error(workflow + " workflow_dispatch failed: HTTP " + dispatched.status);
  }
}

// The commit on main is not the publication: Pages must actually serve it.
async function isLive(fetcher, day, at) {
  const response = await fetcher(SITE + day + "/meta.json?fallback-check=" + at.getTime(), {
    headers: {"User-Agent": "proportion-piece-gallery-fallback"},
  });
  return response.status === 200;
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

  const edition = await fetcher(BASE + "/contents/gallery/" + day + "/meta.json?ref=main", {headers});
  if (edition.status !== 200 && edition.status !== 404) {
    throw new Error("Cannot check current gallery: HTTP " + edition.status);
  }

  if (edition.status === 200) {
    // A published edition is immutable: never start another build for it.
    // Only repair delivery when the committed edition is not live on Pages.
    if (await isLive(fetcher, day, at)) {
      console.log("Gallery " + day + " is live; no dispatch");
      return "already-published";
    }
    if (await anyActive(fetcher, headers, WORKFLOW) || await anyActive(fetcher, headers, PAGES_WORKFLOW)) {
      console.log("Gallery " + day + " is committed but not live; a run is already active");
      return "already-active";
    }
    const receipt = await fetcher(BASE + "/contents/gallery/" + day + "/media-publication.json?ref=main", {headers});
    if (receipt.status === 200) {
      // R2 edition: the gallery workflow's recover job verifies every R2
      // object, redeploys Pages and waits for the live edition.
      await dispatch(fetcher, headers, WORKFLOW, {ref: "main", inputs: {date: day}});
      console.log("Gallery " + day + " not live; dispatched R2 recovery");
      return "recovery-dispatched";
    }
    if (receipt.status !== 404) throw new Error("Cannot check R2 receipt: HTTP " + receipt.status);
    // Legacy Git-backed edition: a Pages deployment is the whole repair.
    await dispatch(fetcher, headers, PAGES_WORKFLOW, {ref: "main"});
    console.log("Gallery " + day + " not live; dispatched Pages deployment");
    return "pages-dispatched";
  }

  // An active GitHub run is already handling this date (or blocking it in the
  // workflow-wide concurrency group). Avoid adding another queued run.
  if (await anyActive(fetcher, headers, WORKFLOW)) {
    console.log("Gallery workflow is already active; no dispatch");
    return "already-active";
  }

  // workflow_dispatch does not commit a trigger file or modify main.
  await dispatch(fetcher, headers, WORKFLOW, {ref: "main"});
  console.log("Dispatched gallery recovery for " + day);
  return "dispatched";
}

export default {
  scheduled(_event, env, ctx) {
    ctx.waitUntil(checkAndDispatch(env));
  },
};
