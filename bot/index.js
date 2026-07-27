const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true
});

const MINI_APP_URL = process.env.MINI_APP_URL;

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    "Welcome to ZA Bingo 🎱\n\nPlease share your phone number to create your player account.",
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: "📱 Share Contact",
              request_contact: true
            }
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
});

bot.on('contact', async (msg) => {
  const telegramId = String(msg.from.id);
  const phone = msg.contact.phone_number;

  const playerRef = db.ref(`telegram_lookup/${telegramId}`);

  const existing = await playerRef.once('value');

  let playerId;

  if (existing.exists()) {
    playerId = existing.val().playerId;
  } else {
    playerId = `player_${telegramId}`;

    await db.ref(`players/${playerId}`).set({
      telegramId,
      username: msg.from.username || "",
      phoneNumber: phone,
      displayName: msg.from.first_name || "Player",
      balance: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      totalWinnings: 0,
      registrationDate: Date.now()
    });

    await playerRef.set({
      playerId
    });
  }

  await bot.sendMessage(
    msg.chat.id,
    "Account ready ✅\nOpen ZA Bingo:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎱 Open ZA Bingo",
              web_app: {
                url: MINI_APP_URL
              }
            }
          ]
        ]
      }
    }
  );
});

console.log("ZA Bingo Telegram Bot running...");
