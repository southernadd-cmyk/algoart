const TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const BOARD_ID = process.env.PINTEREST_BOARD_ID;
const IMAGE_URL = process.env.MEDIA_URL;
const LINK = process.env.SHARE_URL;
const TITLE = process.env.PINTEREST_TITLE || 'ALGO/ART generative artwork';
const DESCRIPTION = process.env.PINTEREST_DESCRIPTION || '';
const ALT_TEXT = process.env.ALT_TEXT || '';
const LIVE = process.env.LIVE_PUBLISHING === 'true';

if (!LIVE) {
  console.log('Pinterest publisher is in DRY RUN mode. Set LIVE_PUBLISHING=true only after testing.');
  process.exit(0);
}

for (const [name, value] of Object.entries({
  PINTEREST_ACCESS_TOKEN: TOKEN,
  PINTEREST_BOARD_ID: BOARD_ID,
  MEDIA_URL: IMAGE_URL,
  SHARE_URL: LINK
})) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

const response = await fetch('https://api.pinterest.com/v5/pins', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    board_id: BOARD_ID,
    link: LINK,
    title: TITLE.slice(0, 100),
    description: DESCRIPTION.slice(0, 500),
    alt_text: ALT_TEXT.slice(0, 500),
    media_source: {
      source_type: 'image_url',
      url: IMAGE_URL,
      is_standard: true
    }
  })
});

const data = await response.json();

if (!response.ok || data.error) {
  const safe = {
    status: response.status,
    error: data?.message || data?.error?.message || 'Pinterest publish failed',
    code: data?.code || data?.error?.code || null
  };
  throw new Error(JSON.stringify(safe));
}

if (!data.id) throw new Error('Pinterest API returned no Pin ID.');

console.log(JSON.stringify({
  platform: 'pinterest',
  pin_id: data.id,
  board_id: data.board_id || BOARD_ID,
  link: data.link || LINK
}, null, 2));
