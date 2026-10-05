const token = process.env.IG_ACCESS_TOKEN;
const expectedUserId = String(process.env.IG_USER_ID || '').trim();
const expectedUsername = (process.env.EXPECTED_IG_USERNAME || 'artalgorithm').replace(/^@/, '');

if (!token) throw new Error('IG_ACCESS_TOKEN is not available to this workflow.');
if (!expectedUserId) throw new Error('IG_USER_ID is not available to this workflow.');

const url = new URL('https://graph.instagram.com/me');
url.searchParams.set('fields', 'user_id,username,account_type');
url.searchParams.set('access_token', token);

const response = await fetch(url, { headers: { accept: 'application/json' } });
const data = await response.json();

if (!response.ok || data.error) {
  const safe = {
    status: response.status,
    error: data?.error?.message || 'Instagram API verification failed',
    type: data?.error?.type || null,
    code: data?.error?.code || null
  };
  throw new Error(JSON.stringify(safe));
}

const returnedId = String(data.user_id || data.id || '').trim();

if (!returnedId || !data.username) {
  throw new Error('Instagram API returned no user id or username.');
}

if (data.username.toLowerCase() !== expectedUsername.toLowerCase()) {
  throw new Error('Token belongs to @' + data.username + ', expected @' + expectedUsername + '.');
}

if (returnedId !== expectedUserId) {
  throw new Error(
    'Instagram user ID mismatch. Token returned ' + returnedId +
    ' but IG_USER_ID secret contains ' + expectedUserId + '.'
  );
}

if (!['MEDIA_CREATOR','CREATOR','BUSINESS'].includes(String(data.account_type || '').toUpperCase())) {
  throw new Error('Unexpected Instagram account type: ' + (data.account_type || 'unknown'));
}

console.log('Instagram token verified successfully.');
console.log('Authorized account: @' + data.username);
console.log('Instagram user ID: ' + returnedId);
console.log('Account type: ' + data.account_type);
