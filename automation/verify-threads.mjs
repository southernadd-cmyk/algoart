const token = process.env.THREADS_ACCESS_TOKEN;
const expected = (process.env.EXPECTED_THREADS_USERNAME || 'artalgorithm').replace(/^@/, '');

if (!token) {
  throw new Error('THREADS_ACCESS_TOKEN is not available to this workflow.');
}

const url = new URL('https://graph.threads.net/me');
url.searchParams.set('fields', 'id,username');
url.searchParams.set('access_token', token);

const response = await fetch(url, {
  headers: { 'accept': 'application/json' }
});

const data = await response.json();

if (!response.ok || data.error) {
  const safe = {
    status: response.status,
    error: data?.error?.message || 'Threads API verification failed',
    type: data?.error?.type || null,
    code: data?.error?.code || null
  };
  throw new Error(JSON.stringify(safe));
}

if (!data.id || !data.username) {
  throw new Error('Threads API returned no app-scoped user id or username.');
}

if (String(data.username).toLowerCase() !== expected.toLowerCase()) {
  throw new Error(
    'Token belongs to @' + data.username + ', expected @' + expected + '.'
  );
}

console.log('Threads token verified successfully.');
console.log('Authorized account: @' + data.username);
console.log('App-scoped user ID: ' + data.id);
