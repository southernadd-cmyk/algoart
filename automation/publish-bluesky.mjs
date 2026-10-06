const HANDLE = process.env.BLUESKY_HANDLE || 'artalgorithm.bsky.social';
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
const MEDIA_URL = process.env.MEDIA_URL;
const CAPTION = process.env.CAPTION || '';
const ALT_TEXT = process.env.ALT_TEXT || '';

if (!APP_PASSWORD) throw new Error('BLUESKY_APP_PASSWORD is required.');
if (!MEDIA_URL) throw new Error('MEDIA_URL is required.');
if (!CAPTION.trim()) throw new Error('CAPTION is required.');

const SERVICE = 'https://bsky.social';

function utf8Length(text) {
  return Buffer.byteLength(text, 'utf8');
}

function linkFacets(text) {
  const facets = [];
  const regex = /https?:\/\/[^\s]+/g;
  for (const match of text.matchAll(regex)) {
    const uri = match[0];
    const charStart = match.index;
    const charEnd = charStart + uri.length;
    const byteStart = utf8Length(text.slice(0, charStart));
    const byteEnd = utf8Length(text.slice(0, charEnd));
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri }]
    });
  }
  return facets;
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemeCount = [...segmenter.segment(CAPTION)].length;
if (graphemeCount > 300) {
  throw new Error(`Bluesky caption is ${graphemeCount} graphemes; limit is 300.`);
}

const sessionResponse = await fetch(`${SERVICE}/xrpc/com.atproto.server.createSession`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: HANDLE, password: APP_PASSWORD })
});
if (!sessionResponse.ok) {
  throw new Error(`Bluesky login failed: ${sessionResponse.status} ${await sessionResponse.text()}`);
}
const session = await sessionResponse.json();

const mediaResponse = await fetch(MEDIA_URL);
if (!mediaResponse.ok) {
  throw new Error(`Could not download artwork: ${mediaResponse.status} ${mediaResponse.statusText}`);
}
const contentType = mediaResponse.headers.get('content-type') || 'image/jpeg';
const media = Buffer.from(await mediaResponse.arrayBuffer());
if (!media.length) throw new Error('Downloaded artwork is empty.');
if (media.length > 1000000) throw new Error(`Bluesky image is too large: ${media.length} bytes.`);

const uploadResponse = await fetch(`${SERVICE}/xrpc/com.atproto.repo.uploadBlob`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${session.accessJwt}`,
    'content-type': contentType
  },
  body: media
});
if (!uploadResponse.ok) {
  throw new Error(`Bluesky image upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
}
const { blob } = await uploadResponse.json();

const record = {
  $type: 'app.bsky.feed.post',
  text: CAPTION,
  createdAt: new Date().toISOString(),
  langs: ['en'],
  facets: linkFacets(CAPTION),
  embed: {
    $type: 'app.bsky.embed.images',
    images: [{ alt: ALT_TEXT, image: blob }]
  }
};

const postResponse = await fetch(`${SERVICE}/xrpc/com.atproto.repo.createRecord`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${session.accessJwt}`,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    repo: session.did,
    collection: 'app.bsky.feed.post',
    record
  })
});
if (!postResponse.ok) {
  throw new Error(`Bluesky publish failed: ${postResponse.status} ${await postResponse.text()}`);
}
const posted = await postResponse.json();
console.log(`Published Bluesky post: ${posted.uri}`);
