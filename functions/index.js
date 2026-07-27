const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');

const { verifyTelegramInitData } = require('./telegramAuth');
const { generateCartela, checkWin } = require('./bingoLogic');

initializeApp();
const db = getDatabase();
setGlobalOptions({ maxInstances: 10, region: 'us-central1' });

const BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');

const RAKE = 0.10;
const COUNTDOWN_MS = 25000;
const CALL_INTERVAL_MS = 3000;
const MAX_CARTELAS_PER_PLAYER = 2;
const MIN_WITHDRAWAL = 50;

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireAuth(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Admin only.');
  return uid;
}

/**
 * Copies the fields the leaderboard needs into a public /leaderboard/{uid}
 * node, so /players (which holds balance) can stay locked to owner+admin.
 */
async function syncLeaderboard(uid) {
  const snap = await db.ref(`players/${uid}`).get();
  const p = snap.val();
  if (!p) return;
  await db.ref(`leaderboard/${uid}`).set({
    name: p.displayName || p.username || 'Player',
    gamesWon: p.gamesWon || 0,
    gamesPlayed: p.gamesPlayed || 0,
    totalWinnings: p.totalWinnings || 0,
  });
}

// ---------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------
exports.telegramAuth = onCall({ secrets: [BOT_TOKEN] }, async (request) => {
  const { initData } = request.data;
  if (!initData) throw new HttpsError('invalid-argument', 'initData required.');

  let tgUser;
  try {
    tgUser = verifyTelegramInitData(initData, BOT_TOKEN.value());
  } catch (err) {
    throw new HttpsError('permission-denied', `Telegram verification failed: ${err.message}`);
  }

  const uid = String(tgUser.id);
  const playerRef = db.ref(`players/${uid}`);
  const snap = await playerRef.get();

  if (!snap.exists()) {
    await playerRef.set({
      telegramId: uid,
      username: tgUser.username || null,
      displayName: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Player',
      phoneNumber: null,
      balance: 0,
      reserved: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      totalWinnings: 0,
      registrationDate: Date.now(),
      referralCode: uid.slice(-6),
      status: 'active',
    });
    await syncLeaderboard(uid);
  }

  const customToken = await getAuth().createCustomToken(uid);
  return { token: customToken };
});

// ---------------------------------------------------------------------
// ROOMS — join a waiting room. RTDB transactions are single-path, so
// this transaction covers the whole /rooms/{roomId} subtree at once
// (that's the one place we get atomicity across playersInRoom + counts).
// ---------------------------------------------------------------------
exports.joinRoom = onCall(async (request) => {
  const uid = requireAuth(request);
  const { roomId } = request.data;
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId required.');

  const roomRef = db.ref(`rooms/${roomId}`);
  const result = await roomRef.transaction((room) => {
    if (!room || room.status !== 'waiting') return; // abort: no-op
    room.playersInRoom = room.playersInRoom || {};
    if (room.playersInRoom[uid]) return room; // already joined
    if ((room.currentPlayers || 0) >= room.maxPlayers) return; // abort: full
    room.playersInRoom[uid] = { cartelaIds: [], joinedAt: Date.now(), paid: false };
    room.currentPlayers = (room.currentPlayers || 0) + 1;
    return room;
  });

  if (!result.committed) throw new HttpsError('failed-precondition', 'Could not join room (full, or already started).');
  return { ok: true };
});

// ---------------------------------------------------------------------
// CARTELAS — lock via transaction on the cartela path, then reserve it
// on the player via a transaction on the player path. RTDB can't do
// both atomically since they're different paths, so if the second step
// fails (already at the 2-cartela cap) we compensate by releasing the
// lock we just took.
// ---------------------------------------------------------------------
exports.pickCartela = onCall(async (request) => {
  const uid = requireAuth(request);
  const { roomId, cartelaId } = request.data;
  if (!roomId || !cartelaId) throw new HttpsError('invalid-argument', 'roomId and cartelaId required.');

  const cartelaRef = db.ref(`rooms/${roomId}/cartelas/${cartelaId}`);
  const roomPlayerRef = db.ref(`rooms/${roomId}/playersInRoom/${uid}`);

  const lockResult = await cartelaRef.transaction((cartela) => {
    if (!cartela) return cartela; // doesn't exist -> abort
    if (cartela.locked && cartela.lockedBy !== uid) return; // taken -> abort
    cartela.locked = true;
    cartela.lockedBy = uid;
    return cartela;
  });
  if (!lockResult.committed) throw new HttpsError('already-exists', 'That cartela is already taken.');

  const playerResult = await roomPlayerRef.transaction((p) => {
    if (!p) return p; // hasn't joined the room -> abort
    const ids = p.cartelaIds || [];
    if (ids.includes(cartelaId)) return p; // already theirs, no-op
    if (ids.length >= MAX_CARTELAS_PER_PLAYER) return; // abort: at cap
    p.cartelaIds = [...ids, cartelaId];
    return p;
  });

  if (!playerResult.committed) {
    await cartelaRef.transaction((cartela) => {
      if (cartela && cartela.lockedBy === uid) { cartela.locked = false; cartela.lockedBy = null; }
      return cartela;
    });
    throw new HttpsError('resource-exhausted', 'Join the room first, or you already hold 2 cartelas.');
  }

  return { ok: true };
});

exports.releaseCartela = onCall(async (request) => {
  const uid = requireAuth(request);
  const { roomId, cartelaId } = request.data;
  const cartelaRef = db.ref(`rooms/${roomId}/cartelas/${cartelaId}`);
  const roomPlayerRef = db.ref(`rooms/${roomId}/playersInRoom/${uid}`);

  await cartelaRef.transaction((cartela) => {
    if (cartela && cartela.lockedBy === uid) { cartela.locked = false; cartela.lockedBy = null; }
    return cartela;
  });
  await roomPlayerRef.transaction((p) => {
    if (!p) return p;
    p.cartelaIds = (p.cartelaIds || []).filter((id) => id !== cartelaId);
    return p;
  });

  return { ok: true };
});

// ---------------------------------------------------------------------
// GAME LOOP — client "pokes" this on a ~1s interval. Server owns all
// timing (25s countdown, 3s call interval) and randomness; a fast or
// modified client gets ignored, not obeyed.
// ---------------------------------------------------------------------
exports.tickRoom = onCall(async (request) => {
  requireAuth(request);
  const { roomId } = request.data;
  const roomRef = db.ref(`rooms/${roomId}`);

  const result = await roomRef.transaction((room) => {
    if (!room) return room;
    const now = Date.now();

    if (room.status === 'waiting') {
      const playersInRoom = room.playersInRoom || {};
      const readyCount = Object.values(playersInRoom).filter((p) => (p.cartelaIds || []).length > 0).length;
      if (readyCount >= 2 && !room.countdownEndsAt) {
        room.countdownEndsAt = now + COUNTDOWN_MS;
      } else if (room.countdownEndsAt && now >= room.countdownEndsAt) {
        room.status = 'starting'; // fee deduction happens outside this transaction, see below
      }
    } else if (room.status === 'in_progress') {
      const lastCalledAt = room.lastCalledAt || 0;
      if (now - lastCalledAt >= CALL_INTERVAL_MS) {
        const called = room.calledNumbers ? Object.values(room.calledNumbers) : [];
        const remaining = [];
        for (let n = 1; n <= 75; n++) if (!called.includes(n)) remaining.push(n);
        if (remaining.length === 0) {
          room.status = 'finished';
          room.endedReason = 'no_numbers_left';
        } else {
          const next = remaining[Math.floor(Math.random() * remaining.length)];
          room.calledNumbers = room.calledNumbers || {};
          room.calledNumbers[called.length] = next;
          room.currentNumber = next;
          room.lastCalledAt = now;
        }
      }
    }
    return room;
  });

  if (result.committed && result.snapshot.val() && result.snapshot.val().status === 'starting') {
    await finalizeGameStart(roomId);
  }

  const finalSnap = await roomRef.get();
  return { status: finalSnap.val() ? finalSnap.val().status : null };
});

/**
 * Deducts entry fees per player. This is NOT one atomic step (RTDB has
 * no cross-path multi-document transactions like Firestore) — it's a
 * sequence of single-player transactions. A player who can't afford
 * the fee at this moment is dropped from the room and their cartelas
 * are released, rather than blocking everyone else from starting.
 */
async function finalizeGameStart(roomId) {
  const roomSnap = await db.ref(`rooms/${roomId}`).get();
  const room = roomSnap.val();
  if (!room) return;

  const entries = Object.entries(room.playersInRoom || {}).filter(([, p]) => (p.cartelaIds || []).length > 0);
  let totalCollected = 0;

  for (const [uid, p] of entries) {
    const fee = room.entryFee * p.cartelaIds.length;
    const result = await db.ref(`players/${uid}/balance`).transaction((bal) => {
      bal = bal || 0;
      if (bal < fee) return; // abort: can't afford it
      return bal - fee;
    });

    if (result.committed) {
      totalCollected += fee;
      await db.ref(`transactions/${uid}`).push({ type: 'game_entry', amount: -fee, roomId, status: 'complete', time: Date.now() });
    } else {
      await db.ref(`rooms/${roomId}/playersInRoom/${uid}`).remove();
      for (const cid of p.cartelaIds) {
        await db.ref(`rooms/${roomId}/cartelas/${cid}`).update({ locked: false, lockedBy: null });
      }
    }
  }

  const prizePool = Math.floor(totalCollected * (1 - RAKE));
  await db.ref(`rooms/${roomId}`).update({
    status: 'in_progress',
    prizePool,
    calledNumbers: {},
    currentNumber: null,
    lastCalledAt: null,
    startedAt: Date.now(),
    countdownEndsAt: null,
  });
}

// ---------------------------------------------------------------------
// BINGO CLAIM — the only place a win is decided. The room transaction's
// atomic flip from in_progress -> finished is what guarantees only the
// first valid claim wins, even if two players claim in the same instant.
// ---------------------------------------------------------------------
exports.claimBingo = onCall(async (request) => {
  const uid = requireAuth(request);
  const { roomId, cartelaId } = request.data;
  const roomRef = db.ref(`rooms/${roomId}`);

  let prizePool = 0;
  let pattern = null;

  const result = await roomRef.transaction((room) => {
    if (!room || room.status !== 'in_progress') return; // abort
    const cartela = (room.cartelas || {})[cartelaId];
    if (!cartela || cartela.lockedBy !== uid) return; // abort: not your cartela
    const called = room.calledNumbers ? Object.values(room.calledNumbers) : [];
    const outcome = checkWin(cartela.numbers, called);
    if (!outcome.win) return; // abort: not a real bingo

    room.status = 'finished';
    room.winner = uid;
    room.winningPattern = outcome.pattern;
    room.endedAt = Date.now();
    prizePool = room.prizePool || 0;
    pattern = outcome.pattern;
    return room;
  });

  if (!result.committed) throw new HttpsError('failed-precondition', 'Not a valid bingo claim.');

  await db.ref(`players/${uid}/balance`).transaction((bal) => (bal || 0) + prizePool);
  await db.ref(`players/${uid}`).transaction((p) => {
    if (!p) return p;
    p.gamesWon = (p.gamesWon || 0) + 1;
    p.totalWinnings = (p.totalWinnings || 0) + prizePool;
    return p;
  });
  await db.ref(`transactions/${uid}`).push({ type: 'prize', amount: prizePool, roomId, status: 'complete', time: Date.now() });

  const roomSnap = await roomRef.get();
  const playersInRoom = (roomSnap.val() || {}).playersInRoom || {};
  await Promise.all(Object.keys(playersInRoom).map(async (pid) => {
    await db.ref(`players/${pid}/gamesPlayed`).transaction((n) => (n || 0) + 1);
    await syncLeaderboard(pid);
  }));

  await db.ref(`gameHistory/${roomId}`).push({ winner: uid, prize: prizePool, pattern, endedAt: Date.now() });

  return { ok: true, prizePool, pattern };
});

// ---------------------------------------------------------------------
// WALLET
// ---------------------------------------------------------------------
exports.requestDeposit = onCall(async (request) => {
  const uid = requireAuth(request);
  const { amount, method, smsConfirmation } = request.data;
  if (!(amount > 0)) throw new HttpsError('invalid-argument', 'Invalid amount.');
  if (!['telebirr', 'cbe'].includes(method)) throw new HttpsError('invalid-argument', 'method must be telebirr or cbe.');

  const ref = db.ref(`deposits/${uid}`).push();
  await ref.set({ amount, method, smsConfirmation: smsConfirmation || null, status: 'pending', createdAt: Date.now() });
  return { requestId: ref.key };
});

exports.requestWithdrawal = onCall(async (request) => {
  const uid = requireAuth(request);
  const { amount, destination } = request.data;
  if (!(amount >= MIN_WITHDRAWAL)) throw new HttpsError('invalid-argument', `Minimum withdrawal is ${MIN_WITHDRAWAL}.`);

  const result = await db.ref(`players/${uid}`).transaction((p) => {
    if (!p) return p;
    const bal = p.balance || 0;
    if (bal < amount) return; // abort: insufficient balance
    p.balance = bal - amount;
    p.reserved = (p.reserved || 0) + amount;
    return p;
  });
  if (!result.committed) throw new HttpsError('failed-precondition', 'Insufficient balance.');

  const ref = db.ref(`withdrawals/${uid}`).push();
  await ref.set({ amount, destination: destination || null, status: 'pending', createdAt: Date.now() });
  return { requestId: ref.key };
});

exports.approveRequest = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const { uid, requestId, type, decision } = request.data;
  if (!['deposit', 'withdrawal'].includes(type)) throw new HttpsError('invalid-argument', 'type must be deposit or withdrawal.');
  if (!['approve', 'reject'].includes(decision)) throw new HttpsError('invalid-argument', 'decision must be approve or reject.');

  const reqRef = db.ref(`${type}s/${uid}/${requestId}`);
  const snap = await reqRef.get();
  if (!snap.exists()) throw new HttpsError('not-found', 'Request not found.');
  const reqData = snap.val();
  if (reqData.status !== 'pending') throw new HttpsError('failed-precondition', 'Request already resolved.');

  if (type === 'deposit' && decision === 'approve') {
    await db.ref(`players/${uid}/balance`).transaction((bal) => (bal || 0) + reqData.amount);
    await db.ref(`transactions/${uid}`).push({ type: 'deposit', amount: reqData.amount, status: 'complete', time: Date.now() });
  }

  if (type === 'withdrawal') {
    if (decision === 'approve') {
      await db.ref(`players/${uid}/reserved`).transaction((r) => (r || 0) - reqData.amount);
      await db.ref(`transactions/${uid}`).push({ type: 'withdrawal', amount: -reqData.amount, status: 'complete', time: Date.now() });
    } else {
      await db.ref(`players/${uid}`).transaction((p) => {
        if (!p) return p;
        p.balance = (p.balance || 0) + reqData.amount;
        p.reserved = (p.reserved || 0) - reqData.amount;
        return p;
      });
    }
  }

  await reqRef.update({ status: decision === 'approve' ? 'approved' : 'rejected', resolvedBy: adminUid, resolvedAt: Date.now() });
  return { ok: true };
});

// ---------------------------------------------------------------------
// ADMIN — seed a room's cartela pool and reset it after a round.
// ---------------------------------------------------------------------
exports.seedRoomCartelas = onCall(async (request) => {
  requireAdmin(request);
  const { roomId, count } = request.data;
  const updates = {};
  for (let i = 1; i <= (count || 150); i++) {
    updates[`rooms/${roomId}/cartelas/${i}`] = { numbers: generateCartela(), locked: false, lockedBy: null };
  }
  await db.ref().update(updates);
  return { ok: true, count: count || 150 };
});

exports.resetRoom = onCall(async (request) => {
  requireAdmin(request);
  const { roomId } = request.data;
  const roomRef = db.ref(`rooms/${roomId}`);
  const snap = await roomRef.get();
  const room = snap.val() || {};
  const count = Object.keys(room.cartelas || {}).length || 150;

  const updates = {};
  for (const cid of Object.keys(room.cartelas || {})) {
    updates[`rooms/${roomId}/cartelas/${cid}/locked`] = false;
    updates[`rooms/${roomId}/cartelas/${cid}/lockedBy`] = null;
  }
  updates[`rooms/${roomId}/playersInRoom`] = null;
  updates[`rooms/${roomId}/currentPlayers`] = 0;
  updates[`rooms/${roomId}/status`] = 'waiting';
  updates[`rooms/${roomId}/calledNumbers`] = null;
  updates[`rooms/${roomId}/currentNumber`] = null;
  updates[`rooms/${roomId}/winner`] = null;
  updates[`rooms/${roomId}/winningPattern`] = null;
  updates[`rooms/${roomId}/countdownEndsAt`] = null;
  updates[`rooms/${roomId}/prizePool`] = 0;

  await db.ref().update(updates);
  return { ok: true, cartelaCount: count };
});
