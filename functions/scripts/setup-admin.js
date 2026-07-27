// Run once per admin: node scripts/setup-admin.js <telegramId>
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node setup-admin.js <telegramId>');
  process.exit(1);
}

getAuth().setCustomUserClaims(uid, { admin: true })
  .then(() => console.log(`${uid} is now an admin.`))
  .catch((err) => { console.error(err); process.exit(1); });
