// Rooms management

function loadRoomsList() {
  const roomsRef = db.ref('rooms');
  setListener('roomsList', roomsRef.on('value', (snap) => {
    const rooms = [];
    snap.forEach((childSnap) => {
      rooms.push({
        id: childSnap.key,
        ...childSnap.val()
      });
    });

    const list = document.getElementById('roomsList');
    if (rooms.length === 0) {
      list.innerHTML = '<p class="loading">No rooms available</p>';
      return;
    }

    list.innerHTML = rooms.map(room => {
      const isFull = room.currentPlayers >= room.maxPlayers;
      const canJoin = !isFull && room.status === 'waiting';
      const balanceOk = (window.playerData?.balance || 0) >= room.entryFee;

      return `
        <div class="room-card">
          <div class="room-info">
            <div class="room-stake">${formatCurrency(room.entryFee)} Entry</div>
            <div class="room-details">
              ${room.currentPlayers}/${room.maxPlayers} players · Prize: ${formatCurrency(room.prizePool || 0)}
            </div>
          </div>
          <button class="room-join-btn" 
                  onclick="joinRoom('${room.id}')"
                  ${canJoin && balanceOk ? '' : 'disabled'}>
            ${!balanceOk ? 'Low balance' : 'Join'}
          </button>
        </div>
      `;
    }).join('');
  }));
}

async function joinRoom(roomId) {
  if (!currentUser) return;

  try {
    haptic('light');
    const joinRoom = functionsRef.httpsCallable('joinRoom');
    await joinRoom({ roomId });
    
    currentRoomId = roomId;
    currentCartelaIds = [];
    loadWaitingRoomData(roomId);
    showScreen('waiting');
  } catch (error) {
    handleError(error);
  }
}

function loadWaitingRoomData(roomId) {
  const roomRef = db.ref(`rooms/${roomId}`);
  
  setListener('waitingRoom', roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;

    // Update countdown display
    if (room.countdownEndsAt) {
      const remaining = Math.max(0, Math.ceil((room.countdownEndsAt - Date.now()) / 1000));
      if (remaining > 0) {
        show('countdownDisplay');
        setText('countdownSeconds', remaining);
        if (remaining === 25) playSound(1000, 100);
      } else {
        hide('countdownDisplay');
      }
    } else {
      hide('countdownDisplay');
    }

    // Update ready count
    const readyCount = Object.values(room.playersInRoom || {})
      .filter(p => (p.cartelaIds || []).length > 0)
      .length;
    setText('readyCount', readyCount);

    // Update prize pool
    const prize = Math.floor((room.entryFee * room.currentPlayers) * 0.85);
    setText('prizePoolWaiting', formatCurrency(prize));

    // Check if game started
    if (room.status === 'in_progress') {
      clearAllListeners();
      loadGameState(roomId);
      showScreen('game');
    }

    // Load cartelas
    const playerCartelasRef = roomRef.child('playersInRoom').child(currentUser.uid);
    setListener('playerCartelas', playerCartelasRef.on('value', (pSnap) => {
      const playerData = pSnap.val() || { cartelaIds: [] };
      currentCartelaIds = playerData.cartelaIds || [];
      updateCartelasGrid(roomId);
    }));
  }));
}

function updateCartelasGrid(roomId) {
  const roomRef = db.ref(`rooms/${roomId}/cartelas`);
  
  setListener('cartelas', roomRef.on('value', (snap) => {
    const cartelas = [];
    snap.forEach((childSnap) => {
      cartelas.push({
        id: childSnap.key,
        ...childSnap.val()
      });
    });

    // Sort by ID
    cartelas.sort((a, b) => Number(a.id) - Number(b.id));

    const grid = document.getElementById('cartelasGrid');
    grid.innerHTML = cartelas.map(cartela => {
      const isMine = currentCartelaIds.includes(cartela.id);
      const isTaken = cartela.locked && !isMine;
      const isSelectable = !isTaken;

      return `
        <button class="cartela-btn ${isMine ? 'selected' : ''} ${isTaken ? 'taken' : ''}"
                onclick="toggleCartela('${roomId}', '${cartela.id}')"
                ${isSelectable ? '' : 'disabled'}>
          ${cartela.id}
        </button>
      `;
    }).join('');

    // Update ready button
    const readyBtn = document.getElementById('readyBtn');
    readyBtn.disabled = currentCartelaIds.length === 0;
  }));
}

async function toggleCartela(roomId, cartelaId) {
  if (!currentUser) return;

  try {
    haptic('light');
    
    if (currentCartelaIds.includes(cartelaId)) {
      // Release cartela
      const releaseCartela = functionsRef.httpsCallable('releaseCartela');
      await releaseCartela({ roomId, cartelaId });
    } else {
      // Pick cartela
      const pickCartela = functionsRef.httpsCallable('pickCartela');
      await pickCartela({ roomId, cartelaId });
    }
  } catch (error) {
    handleError(error);
  }
}

function markPlayerReady() {
  if (currentCartelaIds.length === 0) {
    showMessage('Select at least one cartela first', 'error');
    return;
  }
  
  // This is just a UI hint - the server will deduct fees when the countdown ends
  showMessage('You are ready!', 'success');
  haptic('success');
}

function leaveRoom() {
  if (!currentRoomId) return;
  
  if (confirm('Leave the room?')) {
    clearListener('waitingRoom');
    clearListener('cartelas');
    clearListener('playerCartelas');
    currentRoomId = null;
    currentCartelaIds = [];
    showScreen('rooms');
    haptic('light');
  }
}

// Initialize rooms screen when shown
document.addEventListener('DOMContentLoaded', () => {
  const roomsScreen = document.getElementById('screen-rooms');
  if (roomsScreen) {
    const observer = new MutationObserver(() => {
      if (roomsScreen.classList.contains('active')) {
        loadRoomsList();
      }
    });
    observer.observe(roomsScreen, { attributes: true });
  }
});
