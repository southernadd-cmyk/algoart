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

// Threads can briefly return code 24 (Media Not Found) when a newly created
// media container has not propagated to its status endpoint. Retry creation
// only for that specific pre-publication failure; never retry an ambiguous
// threads_publish request, which could create a duplicate post.
function mediaNotFound(error) {
  try {
    const payload = JSON.parse(error.message);
    return payload?.error?.code === 24 &&
      payload?.error?.error_subcode === 4279009;
  } catch {
    return false;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let container;
let ready = false;

for (let creationAttempt = 0; creationAttempt < 3 && !ready; creationAttempt++) {
  console.log(`Preparing Threads media (attempt ${creationAttempt + 1}/3).`);
  container = await api(`${USER_ID}/threads`, {
    media_type: 'IMAGE',
    image_url: IMAGE_URL,
    text: TEXT,
    alt_text: ALT_TEXT
  });

  for (let attempt = 0; attempt < 30; attempt++) {
    let state;
    try {
      state = await api(container.id, { fields: 'id,status,error_message' }, 'GET');
    } catch (error) {
      if (!mediaNotFound(error)) throw error;
      // Newly created containers can be temporarily invisible to Meta's status API.
      // Poll the full readiness window before abandoning this container.
      console.warn(`Threads container ${container.id} not visible yet (poll ${attempt + 1}/30).`);
      await sleep(3000);
      continue;
    }

    if (state.status === 'FINISHED') {
      ready = true;
      break;
    }
    if (state.status === 'ERROR' || state.status === 'EXPIRED') {
      throw new Error(`Threads container failed: ${JSON.stringify(state)}`);
    }
    await sleep(2000);
  }

  if (!ready && creationAttempt < 2) {
    console.warn(`Threads media not ready (container ${container.id}, attempt ${creationAttempt + 1}); recreating after delay.`);
    await sleep(5000);
  }
}

if (!ready) throw new Error('Threads media container did not become ready after 3 attempts.');

const published = await api(`${USER_ID}/threads_publish`, {
  creation_id: container.id
});

console.log(JSON.stringify({ platform: 'threads', media_id: published.id }, null, 2));
