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

async function api(path, params = {}, method = 'POST') {
  const url = new URL(`https://graph.threads.net/v1.0/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', TOKEN);
  const response = await fetch(url, { method });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(JSON.stringify(json));
  return json;
}

const container = await api(`${USER_ID}/threads`, {
  media_type: 'IMAGE',
  image_url: IMAGE_URL,
  text: TEXT,
  alt_text: ALT_TEXT
});

for (let attempt = 0; attempt < 30; attempt++) {
  const state = await api(container.id, { fields: 'id,status,error_message' }, 'GET');
  if (state.status === 'FINISHED') break;
  if (state.status === 'ERROR' || state.status === 'EXPIRED') {
    throw new Error(`Threads container failed: ${JSON.stringify(state)}`);
  }
  if (attempt === 29) throw new Error('Timed out waiting for Threads media container.');
  await new Promise(resolve => setTimeout(resolve, 2000));
}

const published = await api(`${USER_ID}/threads_publish`, {
  creation_id: container.id
});

console.log(JSON.stringify({ platform: 'threads', media_id: published.id }, null, 2));
