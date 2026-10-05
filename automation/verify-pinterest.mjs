const TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const BOARD_ID = String(process.env.PINTEREST_BOARD_ID || '').trim();

if (!TOKEN) throw new Error('PINTEREST_ACCESS_TOKEN is not available to this workflow.');
if (!BOARD_ID) throw new Error('PINTEREST_BOARD_ID is not available to this workflow.');

async function get(path) {
  const response = await fetch(`https://api.pinterest.com/v5/${path}`, {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/json'
    }
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(JSON.stringify({
      status: response.status,
      error: data?.message || data?.error?.message || 'Pinterest API verification failed',
      code: data?.code || data?.error?.code || null
    }));
  }
  return data;
}

const account = await get('user_account');
const boards = await get('boards?page_size=100');
const board = (boards.items || []).find(item => String(item.id) === BOARD_ID);

if (!account.id || !account.username) {
  throw new Error('Pinterest API returned no user account id or username.');
}
if (!board) {
  throw new Error('Configured PINTEREST_BOARD_ID was not found among this account\'s boards.');
}

console.log('Pinterest token verified successfully.');
console.log('Authorized account: @' + account.username);
console.log('Account type: ' + (account.account_type || 'unknown'));
console.log('Board: ' + board.name + ' (' + board.id + ')');
