const LIVE = process.env.LIVE_PUBLISHING === 'true';
const API_VERSION = process.env.META_API_VERSION || 'v26.0';
const TOKEN = process.env.IG_ACCESS_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const IMAGE_URL = process.env.MEDIA_URL;
const CAPTION = process.env.CAPTION || '';
const ALT_TEXT = process.env.ALT_TEXT || '';

if (!LIVE) {
  console.log('Instagram publisher is in DRY RUN mode. Set LIVE_PUBLISHING=true only after testing.');
  process.exit(0);
}

for (const [name, value] of Object.entries({
  IG_ACCESS_TOKEN: TOKEN,
  IG_USER_ID: USER_ID,
  MEDIA_URL: IMAGE_URL
})) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

async function graph(path, params = {}, method = 'POST') {
  const url = new URL(`https://graph.instagram.com/${API_VERSION}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const response = await fetch(url, {
    method,
    ...(method === 'POST'
      ? { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }
      : {})
  });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(JSON.stringify(json));
  return json;
}

const container = await graph(`${USER_ID}/media`, {
  image_url: IMAGE_URL,
  caption: CAPTION,
  alt_text: ALT_TEXT
});

for (let attempt = 0; attempt < 30; attempt++) {
  const url = new URL(`https://graph.instagram.com/${API_VERSION}/${container.id}`);
  url.searchParams.set('fields', 'status_code,status');
  url.searchParams.set('access_token', TOKEN);
  const response = await fetch(url);
  const state = await response.json();
  if (!response.ok || state.error) throw new Error(JSON.stringify(state));
  if (state.status_code === 'FINISHED') break;
  if (state.status_code === 'ERROR' || state.status_code === 'EXPIRED') {
    throw new Error(`Instagram container failed: ${JSON.stringify(state)}`);
  }
  if (attempt === 29) throw new Error('Timed out waiting for Instagram media container.');
  await new Promise(resolve => setTimeout(resolve, 2000));
}

const published = await graph(`${USER_ID}/media_publish`, { creation_id: container.id });
console.log(JSON.stringify({ platform: 'instagram', media_id: published.id }, null, 2));
