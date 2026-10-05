const LIVE = process.env.LIVE_PUBLISHING === 'true';
const TOKEN = process.env.THREADS_ACCESS_TOKEN;
const USER_ID = process.env.THREADS_USER_ID || 'me';
const IMAGE_URL = process.env.MEDIA_URL;
const TEXT = process.env.CAPTION || '';
const ALT_TEXT = process.env.ALT_TEXT || '';

if (!LIVE) {
  console.log('Threads publisher is in DRY RUN mode. Set LIVE_PUBLISHING=true only after testing.');
  process.exit(0);
}

for (const [name, value] of Object.entries({
  THREADS_ACCESS_TOKEN: TOKEN,
  MEDIA_URL: IMAGE_URL
})) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

async function post(path, params) {
  const url = new URL(`https://graph.threads.net/v1.0/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', TOKEN);
  const response = await fetch(url, { method: 'POST' });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(JSON.stringify(json));
  return json;
}

const container = await post(`${USER_ID}/threads`, {
  media_type: 'IMAGE',
  image_url: IMAGE_URL,
  text: TEXT,
  alt_text: ALT_TEXT
});

const published = await post(`${USER_ID}/threads_publish`, {
  creation_id: container.id
});

console.log(JSON.stringify({ platform: 'threads', media_id: published.id }, null, 2));
