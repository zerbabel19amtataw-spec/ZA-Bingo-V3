// Main app orchestration

// Screen management
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  console.log('Initializing ZA Bingo V3...');

  // Set up screen navigation
  setupScreenNavigation();

  // Initialize Telegram Web App
  if (tg) {
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes();

    // Set theme
    tg.setHeaderColor('#1A1F2E');
    tg.setBackgroundColor('#0F1419');
  }

  // Load saved preferences
  const autoMark = getFromStorage('autoMark', false);
  if (document.getElementById('autoMarkCheckbox')) {
    document.getElementById('autoMarkCheckbox').checked = autoMark;
  }

  const sound = getFromStorage('sound', true);
  if (document.getElementById('soundToggle')) {
    document.getElementById('soundToggle').checked = sound;
  }

  const notifications = getFromStorage('notifications', true);
  if (document.getElementById('notificationsToggle')) {
    document.getElementById('notificationsToggle').checked = notifications;
  }

  // Initialize auth
  initializeAuth();
}

function setupScreenNavigation() {
  // Home screen button
  const homeBtn = document.querySelector('[onclick="showScreen(\'home\')"]');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      clearListener('waitingRoom');
      clearListener('cartelas');
      clearListener('playerCartelas');
      currentRoomId = null;
      currentCartelaIds = [];
    });
  }

  // Settings toggle listeners
  document.getElementById('soundToggle')?.addEventListener('change', (e) => {
    saveToStorage('sound', e.target.checked);
  });

  document.getElementById('notificationsToggle')?.addEventListener('change', (e) => {
    saveToStorage('notifications', e.target.checked);
  });
}

// Auto-load data when screens become active
const screenObservers = {
  rooms: () => loadRoomsList(),
  wallet: () => loadWalletBalance(),
  transactions: () => loadTransactionHistory(),
  leaderboard: () => loadLeaderboard(),
 
};

document.addEventListener('DOMContentLoaded', () => {
  Object.entries(screenObservers).forEach(([screen, callback]) => {
    const el = document.getElementById(`screen-${screen}`);
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (el.classList.contains('active')) {
        callback();
      }
    });

    observer.observe(el, { attributes: true });
  });
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

// Network status
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  console.log('Back online');
  showMessage('Connection restored', 'success');
  haptic('success');
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('No internet connection');
  showMessage('No internet connection', 'error');
  notificationHaptic('warning');
});

// Prevent accidental navigation
window.addEventListener('beforeunload', (event) => {
  if (currentRoomId && document.getElementById('screen-game').classList.contains('active')) {
    event.preventDefault();
    event.returnValue = '';
    return '';
  }
});

// Keep screen on (if supported)
if (navigator.wakeLock) {
  let wakeLock = null;

  async function requestWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake lock acquired');
    } catch (err) {
      console.log('Wake lock failed:', err);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.hidden) {
      wakeLock.release();
      wakeLock = null;
    } else if (!document.hidden) {
      requestWakeLock();
    }
  });

  if (!document.hidden) {
    requestWakeLock();
  }
}

// Performance monitoring (optional)
if (window.performance && window.performance.timing) {
  window.addEventListener('load', () => {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    console.log(`Page load time: ${loadTime}ms`);
  });
}

// Service Worker registration (for offline support)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => {
    console.log('Service Worker registration failed:', error);
  });
}

console.log('ZA Bingo V3 initialized');
