// Leaderboard management

let leaderboardData = {};

function switchLeaderboardTab(tab) {
  document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', 
      (i === 0 && tab === 'wins') ||
      (i === 1 && tab === 'winnings') ||
      (i === 2 && tab === 'played')
    );
  });

  updateLeaderboardDisplay(tab);
  haptic('light');
}

function loadLeaderboard() {
  const leaderRef = db.ref('leaderboard');
  setListener('leaderboard', leaderRef.on('value', (snap) => {
    leaderboardData = {};
    snap.forEach((childSnap) => {
      leaderboardData[childSnap.key] = childSnap.val();
    });

    updateLeaderboardDisplay('wins');
  }));
}

function updateLeaderboardDisplay(sortBy) {
  const players = Object.entries(leaderboardData).map(([uid, data]) => ({
    uid,
    ...data
  }));

  // Sort based on selected tab
  if (sortBy === 'wins') {
    players.sort((a, b) => (b.gamesWon || 0) - (a.gamesWon || 0));
  } else if (sortBy === 'winnings') {
    players.sort((a, b) => (b.totalWinnings || 0) - (a.totalWinnings || 0));
  } else if (sortBy === 'played') {
    players.sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0));
  }

  const list = document.getElementById('leaderboardList');
  if (players.length === 0) {
    list.innerHTML = '<p class="loading">Loading leaderboard...</p>';
    return;
  }

  list.innerHTML = players.slice(0, 100).map((player, index) => {
    const rank = index + 1;
    let rankClass = '';
    let rankEmoji = rank <= 10 ? ['🥇', '🥈', '🥉'][Math.min(index, 2)] : `#${rank}`;

    if (rank === 1) rankClass = 'top1';
    if (rank === 2) rankClass = 'top2';
    if (rank === 3) rankClass = 'top3';

    const stat = sortBy === 'wins' ? player.gamesWon || 0 :
                 sortBy === 'winnings' ? formatCurrency(player.totalWinnings || 0) :
                 player.gamesPlayed || 0;

    const statLabel = sortBy === 'wins' ? 'wins' :
                      sortBy === 'winnings' ? 'winnings' :
                      'games';

    return `
      <div class="leaderboard-row">
        <div class="leaderboard-rank ${rankClass}">${rankEmoji}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${player.name}</div>
          <div class="leaderboard-stat">${player.gamesPlayed || 0} games</div>
        </div>
        <div class="leaderboard-value">${stat}</div>
      </div>
    `;
  }).join('');
}

// Initialize leaderboard when shown
document.addEventListener('DOMContentLoaded', () => {
  const leaderboardScreen = document.getElementById('screen-leaderboard');
  if (leaderboardScreen) {
    const observer = new MutationObserver(() => {
      if (leaderboardScreen.classList.contains('active')) {
        loadLeaderboard();
      }
    });
    observer.observe(leaderboardScreen, { attributes: true });
  }
});
