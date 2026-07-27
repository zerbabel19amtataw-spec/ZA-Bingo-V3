// Run once: node scripts/create-rooms.js

const { cert, initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { generateCartela } = require('../bingoLogic');

// Firebase Admin authentication
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = getDatabase();

const ROOMS = [
  { id: 'room-1', entryFee: 5, maxPlayers: 30 },
  { id: 'room-2', entryFee: 10, maxPlayers: 30 },
  { id: 'room-3', entryFee: 20, maxPlayers: 30 },
];

(async () => {
  try {
    for (const room of ROOMS) {
      const cartelas = {};

      for (let i = 1; i <= 150; i++) {
        cartelas[i] = {
          numbers: generateCartela(),
          locked: false,
          lockedBy: null
        };
      }

      await db.ref(`rooms/${room.id}`).set({
        entryFee: room.entryFee,
        maxPlayers: room.maxPlayers,
        currentPlayers: 0,
        status: 'waiting',
        prizePool: 0,
        cartelas,
      });

      console.log(`Created ${room.id} with 150 cartelas`);
    }

    console.log("All rooms created successfully");
    process.exit(0);

  } catch (error) {
    console.error("Room creation failed:", error);
    process.exit(1);
  }
})();
