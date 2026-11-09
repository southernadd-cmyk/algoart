/**
 * PROPORTION PIECE media gateway — read-only, deliberately narrow.
 * DRAFT ONLY: isolated planning branch; never deploys the social Worker.
 * Only immutable SHA-256-addressed edition files may be served.
 * R2 binding MEDIA points exclusively to proportion-piece-media-test.
 */
const PAGES_ORIGIN = "https://southernadd-cmyk.github.io";
const DATE = "\\d{4}-\\d{2}-\\d{2}";
const HASH = "[a-f0-9]{64}";
const ARTWORK_KEY = new RegExp(
  "^editions/" + DATE + "/[A-Za-z0-9_-]+/(?:original-" + HASH +
  "\\.(?:jpg|jpeg|png)|(?:desktop|mobile)-" + HASH + "\\.webp)$"
);
const EDITION_KEY = new RegExp(
  "^editions/" + DATE + "/(?:cover-" + HASH + "\\.jpg|sculptures-" +
  HASH + "\\.json\\.gz)$"
);
const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", "json.gz": "application/gzip",
};

function isMediaKey(key) {
  return key.length <= 320 && (ARTWORK_KEY.test(key) || EDITION_KEY.test(key));
}
function contentType(key) {
  const ext = key.endsWith(".json.gz") ? "json.gz" : key.slice(key.lastIndexOf(".") + 1);
  return MIME[ext];
}
function responseHeaders(origin) {
  const h = new Headers({
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
    // Exact fixed origin avoids variant-cache poisoning across Origin headers.
    "Access-Control-Allow-Origin": PAGES_ORIGIN,
  });
  return h;
}
function error(status, message, origin) {
  const h = responseHeaders(origin);
  h.set("Content-Type", "text/plain; charset=utf-8");
  h.set("Cache-Control", "no-store");
  if (status === 405) h.set("Allow", "GET, HEAD, OPTIONS");
  return new Response(message, { status, headers: h });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (origin !== PAGES_ORIGIN ||
          !["GET", "HEAD"].includes(request.headers.get("Access-Control-Request-Method")))
        return error(403, "Origin or preflight method not allowed", origin);
      const h = responseHeaders(origin);
      h.set("Access-Control-Allow-Methods", "GET, HEAD");
      h.set("Access-Control-Max-Age", "3600");
      h.set("Cache-Control", "no-store");
      return new Response(null, { status: 204, headers: h });
    }
    if (request.method !== "GET" && request.method !== "HEAD")
      return error(405, "Read-only media service", origin);
    const url = new URL(request.url);
    if (url.search || !isMediaKey(url.pathname.slice(1)))
      return error(404, "Not found", origin);

    const key = url.pathname.slice(1);
    const media = env.MEDIA;
    // A missing binding must fail closed, not use a different R2 bucket.
    if (!media || typeof media.get !== "function" || typeof media.head !== "function")
      return error(503, "Media temporarily unavailable", origin);
    try {
      const obj = request.method === "HEAD"
        ? await media.head(key)
        : await media.get(key);
      if (!obj) return error(404, "Not found", origin);
      const headers = responseHeaders(origin);
      // Prefer verified content type from key, not arbitrary stored metadata.
      headers.set("Content-Type", contentType(key));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      if (Number.isFinite(obj.size)) headers.set("Content-Length", String(obj.size));
      if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
      return new Response(request.method === "HEAD" ? null : obj.body,
        { status: 200, headers });
    } catch (cause) {
      console.error("Read-only media retrieval failed", String(cause?.message || cause));
      return error(503, "Media temporarily unavailable", origin);
    }
  },
};