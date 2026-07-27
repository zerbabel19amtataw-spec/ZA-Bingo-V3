# ZA Bingo V3 — Production Build

Complete production-ready Telegram Mini App bingo platform using Firebase Realtime Database and Cloud Functions. This is a fully functional, real-money multiplayer game with rooms, cartelas, live number calling, wallet, leaderboard, and chat.

## What's Included

**Backend (Cloud Functions)**
- Telegram authentication with initData verification
- Real-time game state management
- Secure bingo card generation and win validation
- Entry fee deduction and prize pool calculation
- Deposit/withdrawal request management with admin approval
- All money transactions are server-validated — client never touches balances

**Frontend (Single-page app, vanilla JS)**
- Home screen with player stats
- Profile editing (name, avatar, phone)
- Wallet (deposit/withdrawal requests, transaction history)
- Real-time leaderboard (sortable by wins, winnings, games played)
- Room list with live player counts
- Waiting room with cartela selection (up to 2 per player, prevents duplicates)
- Game screen with bingo card, number caller, auto-mark option
- Real-time chat in game rooms
- Winner animations and confetti
- Settings (sound, notifications)
- Full offline support via Service Worker

## Technology

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6)
- **Database:** Firebase Realtime Database
- **Authentication:** Firebase Auth + Telegram initData verification
- **Backend:** Firebase Cloud Functions (Node.js)
- **Platform:** Telegram Mini App SDK

## Setup

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Realtime Database** (choose a region, US is default)
4. Enable **Cloud Functions** (this requires Blaze plan)
5. Enable **Firebase Hosting**
6. Get your project config from **Project Settings** → **Your apps** → **Web**

### 2. Telegram Bot Setup

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Run `/newapp` and follow prompts
3. Set the app name to "ZA Bingo"
4. Set the URL to your Firebase Hosting domain (e.g., `https://za-bingo-v3.web.app/`)
5. Save your **Bot Token**

### 3. Local Setup

```bash
# Clone or extract the project
cd za-bingo-v3

# Install dependencies
cd functions
npm install
cd ..

# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login
```

### 4. Configure Firebase Credentials

```bash
# Set your Firebase project
firebase use YOUR_PROJECT_ID

# Set the Telegram bot token as a secret
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
# Paste your bot token when prompted
```

### 5. Update Firebase Config in Frontend

Edit `public/firebase.js` and replace the config with your project's web app config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 6. Deploy

```bash
# Deploy everything (database rules, functions, hosting)
firebase deploy

# Or deploy selectively
firebase deploy --only database,functions    # Just backend
firebase deploy --only hosting                # Just frontend
```

### 7. Initialize Game Data

```bash
# Create the three game rooms (5, 10, 20 Br stakes)
node scripts/create-rooms.js

# Grant yourself admin access (replace with YOUR Telegram ID)
node scripts/setup-admin.js 123456789
```

### 8. Register with Telegram

1. Go back to [@BotFather](https://t.me/botfather)
2. Find your app in `/myapps`
3. Copy the app URL from your Firebase Hosting
4. Paste it into BotFather's URL field
5. Test by clicking the app link in the bot's menu

## Data Model

```
/players/{uid}
  telegramId, username, displayName, phoneNumber, avatar
  balance, reserved
  gamesPlayed, gamesWon, totalWinnings
  registrationDate, referralCode, status

/leaderboard/{uid}
  name, gamesWon, gamesPlayed, totalWinnings (denormalized, public read)

/rooms/{roomId}
  entryFee, maxPlayers, currentPlayers, status, prizePool
  calledNumbers, currentNumber, lastCalledAt
  countdownEndsAt, startedAt, endedAt
  winner, winningPattern

/rooms/{roomId}/cartelas/{id}
  numbers (fixed 25-cell array), locked, lockedBy

/rooms/{roomId}/playersInRoom/{uid}
  cartelaIds, joinedAt, paid

/rooms/{roomId}/chat/{id}
  playerId, playerName, text, time

/transactions/{uid}/{id}
  type (deposit, withdrawal, game_entry, prize)
  amount, status, time, roomId

/deposits/{uid}/{id}
  amount, method (telebirr, cbe), smsConfirmation
  status (pending, approved, rejected), createdAt

/withdrawals/{uid}/{id}
  amount, destination
  status (pending, approved, rejected), createdAt

/gameHistory/{roomId}/{id}
  winner, prize, pattern, endedAt
```

## Security Model

- **Authentication:** Telegram Mini App initData verified server-side, mints a Firebase custom token
- **Balance & Prizes:** Cloud Functions only — client can read, never write
- **Game Outcomes:** Validated server-side; client never decides who wins
- **Cartela Locks:** RTDB transaction prevents duplicate ownership within a room
- **Database Rules:** Public reads for game state and leaderboard, owner-only reads for balances

## Key Features

✅ Real-time multiplayer game (25-second countdown, 3-second caller)
✅ 75-ball standard bingo (rows, columns, diagonals, four corners, full house)
✅ Secure wallet (Telebirr & CBE deposit methods, admin-approved withdrawals)
✅ Live leaderboard (sortable)
✅ In-game chat with profanity filter
✅ Transaction history
✅ Player profiles (editable name/avatar)
✅ Responsive mobile design
✅ Offline support (Service Worker)
✅ Haptic feedback & sound effects
✅ Auto mark option
✅ Confetti winner animation

## Architecture Notes

**Why Realtime Database instead of Firestore?**
RTDB is simpler for real-time multiplayer games, cheaper at scale, and sufficient here. Transactions are single-path, so some operations (like multi-player fee deduction) are sequences of atomic steps rather than cross-document transactions — this is acceptable and normal for RTDB.

**Why Cloud Functions validate everything?**
The client is untrusted. Entry fees, prize distributions, and winner decisions happen only in Cloud Functions using the Admin SDK, which bypasses database rules. This prevents cheating.

**Why Telegram auth over anonymous auth?**
Anonymous auth alone can't prove identity — anyone could claim to be any player by opening the app fresh. Telegram's initData signature is cryptographically verified server-side, proving the actual Telegram user.

## Production Considerations

Before launching with real money:

1. **Regulatory compliance:** Real-money bingo is regulated in most countries. Check KYC, AML, licensing requirements for your jurisdiction.
2. **Payment integration:** The deposit/withdrawal system currently stores requests pending manual admin approval. For production, integrate a real payment processor (Telebirr API, CBE API).
3. **Monitoring & analytics:** Add transaction logging and fraud detection.
4. **Rate limiting:** Add Cloud Function rate limiting to prevent abuse.
5. **User support:** Add a proper support ticket system (beyond the basic help screen).
6. **Terms & conditions:** Create and display T&C, privacy policy, responsible gaming information.

## Troubleshooting

**Players not logging in?**
- Verify Telegram bot is properly registered with the correct URL
- Check Firebase auth is enabled and allows anonymous signin
- Check Cloud Function logs: `firebase functions:log`

**Rooms not creating?**
- Run `node scripts/create-rooms.js` again
- Check RTDB has been initialized in your Firebase project

**Deposits not processing?**
- Verify Cloud Function `approveRequest` is working
- Check `/deposits` node in Realtime Database for pending requests

**Game state not syncing?**
- Ensure all players have a stable internet connection
- Check that `tickRoom` is being called (should log to console)
- Verify RTDB rules allow public read on `/rooms`

## Local Development

To test locally before deploying:

```bash
# Start the emulators
firebase emulators:start

# In another terminal, run the frontend
# Serve the `public` folder on localhost:5000 or use a local server
npx http-server public -p 5000
```

Then open http://localhost:5000 in your browser.

## File Structure

```
za-bingo-v3/
├── functions/
│   ├── index.js              Cloud Functions (all game logic)
│   ├── bingoLogic.js         Card generation & win checking
│   ├── telegramAuth.js       Telegram signature verification
│   ├── package.json
├── public/
│   ├── index.html            Single-page app shell
│   ├── style.css             Dark premium UI theme
│   ├── firebase.js           Firebase init & global state
│   ├── utils.js              Helpers, navigation, sound, haptics
│   ├── auth.js               Telegram login flow
│   ├── profile.js            Profile screen
│   ├── wallet.js             Deposits, withdrawals, history
│   ├── rooms.js              Rooms list, waiting room, cartelas
│   ├── game.js               Game screen, caller, chat, claiming bingo
│   ├── leaderboard.js        Leaderboard with sorting
│   ├── app.js                Main orchestration
│   ├── sw.js                 Service Worker
├── scripts/
│   ├── create-rooms.js       Initialize game rooms
│   ├── setup-admin.js        Grant admin privileges
├── database.rules.json       RTDB security rules
├── firebase.json             Project configuration
└── README.md
```

## Next Steps for Enhancement

- Admin dashboard (approve withdrawals, ban players, view analytics)
- Referral system (track and reward new player signups)
- Push notifications (countdown, game start, winner declared)
- Video/image uploads for avatars (using Cloud Storage)
- Tournaments/seasonal leaderboards
- Bonus events (double prizes on certain times)
- Multi-language support

Good luck with your bingo platform! 🎉
