// Game management

let cartelaData = {};
let gameTickInterval = null;
let chatMessages = [];

async function loadGameState(roomId) {
  currentRoomId = roomId;
  
  const roomRef = db.ref(`rooms/${roomId}`);
  setListener('gameRoom', roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;

    gameState.status = room.status;
    gameState.calledNumbers = room.calledNumbers ? Object.values(room.calledNumbers) : [];
    gameState.currentNumber = room.currentNumber;
    gameState.winner = room.winner;
    gameState.prizePool = room.prizePool || 0;
    gameState.playersInRoom = room.playersInRoom || {};

    // Update UI
    updateGameUI(room);

    // Check for winner
    if (room.winner && room.status === 'finished') {
      showWinner(room);
    }
  }));

  // Load cartela data once
  const cartelaRef = db.ref(`rooms/${roomId}/cartelas`);
  const cartelasSnap = await cartelaRef.get();
  cartelasSnap.forEach((childSnap) => {
    cartelaData[childSnap.key] = childSnap.val();
  });

  // Load first cartela owned by this player
  for (const cartelaId of currentCartelaIds) {
    if (cartelaData[cartelaId]) {
      renderBingoCard(cartelaData[cartelaId].numbers);
      break;
    }
  }

  // Start ticker
  startGameTicker(roomId);

  // Load chat
  loadGameChat(roomId);
}

function updateGameUI(room) {
  setText('playersCount', `${Object.keys(room.playersInRoom || {}).length} players`);
  setText('prizeDisplay', formatCurrency(room.prizePool || 0));

  updateCalledNumbers();
  updateBingoCard();
}

function updateCalledNumbers() {
  const currentNum = gameState.currentNumber;
  if (currentNum) {
    setText('currentNumber', currentNum);
    playSound(800, 50);
  }

  const strip = document.getElementById('historyStrip');
  strip.innerHTML = gameState.calledNumbers.map((num, i) => {
    const isLatest = i === gameState.calledNumbers.length - 1;
    return `<div class="number-ball ${isLatest ? 'latest' : ''}">${num}</div>`;
  }).join('');
  strip.scrollLeft = strip.scrollWidth;
}

function renderBingoCard(numbers) {
  const card = document.getElementById('bingoCard');
  card.innerHTML = numbers.map((num, index) => {
    const isFree = num === 'FREE';
    const isMarked = gameState.calledNumbers.includes(num);

    return `
      <div class="bingo-cell ${isFree ? 'free' : ''} ${isMarked ? 'marked' : ''}"
           onclick="toggleCell(${index})"
           data-value="${num}">
        ${num}
      </div>
    `;
  }).join('');
}

function updateBingoCard() {
  // Update marked cells based on called numbers and auto-mark setting
  const isAutoMark = document.getElementById('autoMarkCheckbox')?.checked;

  document.querySelectorAll('#bingoCard .bingo-cell').forEach((cell) => {
    const value = cell.dataset.value;
    if (value === 'FREE' || gameState.calledNumbers.includes(Number(value))) {
      if (isAutoMark || cell.classList.contains('marked')) {
        cell.classList.add('marked');
      }
    } else {
      if (!isAutoMark) {
        // User manually toggles only if not auto-marking
      }
    }
  });
}

function toggleCell(index) {
  if (document.getElementById('autoMarkCheckbox')?.checked) return; // Can't toggle in auto-mark mode

  const cell = document.querySelectorAll('#bingoCard .bingo-cell')[index];
  if (!cell) return;

  const value = cell.dataset.value;
  const num = Number(value);

  // Only allow toggling if the number hasn't been called
  if (gameState.calledNumbers.includes(num)) {
    cell.classList.add('marked');
    return;
  }

  cell.classList.toggle('marked');
  haptic('light');
}

function toggleAutoMark() {
  const isAutoMark = document.getElementById('autoMarkCheckbox').checked;
  if (isAutoMark) {
    showMessage('Auto Mark enabled', 'success');
  } else {
    showMessage('Auto Mark disabled', 'success');
  }
  updateBingoCard();
  saveToStorage('autoMark', isAutoMark);
}

async function claimBingo() {
  if (!currentUser || !currentRoomId || currentCartelaIds.length === 0) return;

  try {
    disable('claimBtn');
    
    // Try claiming the first cartela
    for (const cartelaId of currentCartelaIds) {
      try {
        const claimBingo = functionsRef.httpsCallable('claimBingo');
        const { data } = await claimBingo({ roomId: currentRoomId, cartelaId });
        
        playWinnerSound();
        createConfetti();
        haptic('success');
        enable('claimBtn');
        return; // Success!
      } catch (e) {
        // Try next cartela
        continue;
      }
    }

    // No valid bingo
    showMessage('Not a bingo yet', 'error');
    enable('claimBtn');
  } catch (error) {
    handleError(error);
    enable('claimBtn');
  }
}

function showWinner(room) {
  const modal = document.getElementById('winnerModal');
  const isWinner = room.winner === currentUser.uid;

  setText('winnerName', isWinner ? 'You Won!' : 'Game Over');
  setText('winnerPrize', formatCurrency(room.prizePool || 0));
  setText('winnerPattern', room.winningPattern || 'Unknown pattern');

  if (isWinner) {
    playWinnerSound();
    createConfetti();
    haptic('success');
  }

  modal.style.display = 'flex';
}

function dismissWinner() {
  document.getElementById('winnerModal').style.display = 'none';
  clearAllListeners();
  currentRoomId = null;
  currentCartelaIds = [];
  showScreen('rooms');
}

function startGameTicker(roomId) {
  if (gameTickInterval) clearInterval(gameTickInterval);

  // Call the tickRoom function every 1 second to sync game state
  gameTickInterval = setInterval(async () => {
    try {
      const tickRoom = functionsRef.httpsCallable('tickRoom');
      await tickRoom({ roomId });
    } catch (e) {
      // Ignore errors, will retry next interval
    }
  }, 1000);
}

// Chat functionality
function toggleGameChat() {
  const overlay = document.getElementById('chatOverlay');
  overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
  if (overlay.style.display === 'flex') {
    document.getElementById('chatInput').focus();
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
  }
  haptic('light');
}

function loadGameChat(roomId) {
  const chatRef = db.ref(`rooms/${roomId}/chat`);
  setListener('gameChat', chatRef.on('value', (snap) => {
    chatMessages = [];
    snap.forEach((childSnap) => {
      chatMessages.push({
        id: childSnap.key,
        ...childSnap.val()
      });
    });

    // Sort by timestamp
    chatMessages.sort((a, b) => a.time - b.time);
    updateChatDisplay();
  }));
}

function updateChatDisplay() {
  const messagesEl = document.getElementById('chatMessages');
  messagesEl.innerHTML = chatMessages.map(msg => {
    const filtered = filterProfanity(msg.text);
    return `
      <div class="chat-message">
        <div class="chat-message-name">${msg.playerName}</div>
        <div class="chat-message-text">${filtered}</div>
      </div>
    `;
  }).join('');
  
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function handleChatKeypress(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

async function sendChatMessage() {
  if (!currentUser || !currentRoomId) return;

  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  try {
    const chatRef = db.ref(`rooms/${currentRoomId}/chat`).push();
    await chatRef.set({
      playerId: currentUser.uid,
      playerName: window.playerData?.displayName || 'Player',
      text,
      time: Date.now()
    });

    input.value = '';
    haptic('light');
  } catch (error) {
    console.error('Chat error:', error);
  }
}

// Cleanup on page visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameTickInterval) {
    clearInterval(gameTickInterval);
  } else if (!document.hidden && currentRoomId) {
    startGameTicker(currentRoomId);
  }
});

// Restore auto-mark setting
document.addEventListener('DOMContentLoaded', () => {
  const autoMark = getFromStorage('autoMark', false);
  if (document.getElementById('autoMarkCheckbox')) {
    document.getElementById('autoMarkCheckbox').checked = autoMark;
  }
});
