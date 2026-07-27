// Auth initialization and management

async function initializeAuth() {
  try {
    const tgInitData = tg ? tg.initData : '';
    if (!tgInitData) {
      console.error('No Telegram initData available');
      setTimeout(initializeAuth, 1000);
      return;
    }

    // Call the telegramAuth Cloud Function
    const telegramAuth = functionsRef.httpsCallable('telegramAuth');
    const { data } = await telegramAuth({ initData: tgInitData });

    // Sign in with the custom token
    await auth.signInWithCustomToken(data.token);
    console.log('Authenticated successfully');
  } catch (error) {
    console.error('Auth initialization failed:', error);
    handleError(error);
    setTimeout(initializeAuth, 2000);
  }
}

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Try to sign in again if not authenticated
    setTimeout(initializeAuth, 500);
    return;
  }

  currentUser = user;
  console.log('User authenticated:', user.uid);
  
  // Load player data
  loadPlayerData(user.uid);
  
  // Show home screen
  showScreen('home');
});

// Load player profile data
function loadPlayerData(uid) {
  const playerRef = db.ref(`players/${uid}`);
  setListener('playerData', playerRef.on('value', (snap) => {
    const player = snap.val();
    if (!player) return;

    // Update topbar balance
    setText('balancePill', formatCurrency(player.balance || 0));

    // Store player data globally
    window.playerData = player;

    // Update home screen
    updateHomeScreen(player);
  }));
}

function updateHomeScreen(player) {
  if (!document.getElementById('screen-home').classList.contains('active')) return;
  
  setText('homePlayerName', player.displayName || 'Player');
  setText('homePlayerSub', `@${player.username || 'user'}`);
  setText('homeGamesWon', player.gamesWon || 0);
  setText('homeGamesPlayed', player.gamesPlayed || 0);
  
  const winRate = player.gamesPlayed > 0 
    ? Math.round((player.gamesWon / player.gamesPlayed) * 100)
    : 0;
  setText('homeWinRate', `${winRate}%`);
  setText('homeTotalWinnings', formatCurrency(player.totalWinnings || 0));
}

// Logout
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    clearAllListeners();
    auth.signOut().then(() => {
      window.location.reload();
    });
  }
}

// Start auth on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initializeAuth, 500);
});
