const crypto = require('crypto');

/**
 * Verifies Telegram Mini App initData. This is the only thing that
 * proves a login actually came from Telegram — required even when using
 * Realtime Database + Anonymous Auth, because anonymous auth alone
 * carries no proof of which Telegram user is signing in. We use this to
 * mint a Firebase custom token keyed to the verified Telegram ID instead.
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('missing hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) throw new Error('invalid initData signature');

  const authDate = Number(params.get('auth_date') || '0');
  if (Date.now() / 1000 - authDate > 60 * 60 * 24) throw new Error('initData expired');

  const user = JSON.parse(params.get('user') || '{}');
  if (!user.id) throw new Error('missing user in initData');
  return user;
}

module.exports = { verifyTelegramInitData };
