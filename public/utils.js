const tg = window.Telegram && window.Telegram.WebApp;

// Initialize Telegram Web App
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes();
}

// Screen Navigation
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const screen = document.getElementById(`screen-${name}`);
  if (screen) {
    screen.classList.add('active');
    screen.scrollTop = 0;
  }
}

// Format currency
function formatCurrency(amount) {
  return `${Math.round(amount)} Br`;
}

// Format date
function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-ET', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' });
}

// Show message
function showMessage(message, type = 'info') {
  const msgEl = document.getElementById('walletMessage') || document.getElementById('gameMessage');
  if (!msgEl) return;
  msgEl.textContent = message;
  msgEl.className = `message-box show ${type}`;
  setTimeout(() => msgEl.classList.remove('show'), 4000);
}

// DOM Helpers
function setText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

function setHTML(elementId, html) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = html;
}

function show(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = '';
}

function hide(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = 'none';
}

function disable(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.disabled = true;
}

function enable(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.disabled = false;
}

// Telegram Haptic Feedback
function haptic(type = 'light') {
  if (tg) tg.HapticFeedback.impactOccurred(type);
}

function notificationHaptic(type = 'success') {
  if (tg) tg.HapticFeedback.notificationOccurred(type);
}

// Sound Effects
const soundContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency = 800, duration = 100) {
  if (!document.getElementById('soundToggle')?.checked) return;
  try {
    const now = soundContext.currentTime;
    const osc = soundContext.createOscillator();
    const gain = soundContext.createGain();
    osc.connect(gain);
    gain.connect(soundContext.destination);
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);
    osc.start(now);
    osc.stop(now + duration / 1000);
  } catch (e) {
    // Soundcontext may not be available or audio may be blocked
  }
}

function playWinnerSound() {
  playSound(1200, 100);
  setTimeout(() => playSound(1400, 100), 150);
  setTimeout(() => playSound(1600, 200), 300);
}

// Confetti
function createConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;
  
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    const tx = (Math.random() - 0.5) * 400;
    const ty = (Math.random() + 1) * 400;
    const rotation = Math.random() * 360;
    confetti.style.setProperty('--tx', `${tx}px`);
    confetti.style.setProperty('--ty', `${ty}px`);
    confetti.style.left = '50%';
    confetti.style.top = '50%';
    confetti.style.background = ['#FFD700', '#00C878', '#9C27B0'][Math.floor(Math.random() * 3)];
    container.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
  }
}

// Countdown Timer
function startCountdown(seconds, callback, updateCallback) {
  let remaining = seconds;
  const interval = setInterval(() => {
    remaining--;
    if (updateCallback) updateCallback(remaining);
    if (remaining <= 0) {
      clearInterval(interval);
      if (callback) callback();
    }
  }, 1000);
  return () => clearInterval(interval);
}

// Validation
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhoneNumber(phone) {
  // Basic Ethiopian phone number validation
  return /^[\d+\s\-()]{10,}$/.test(phone);
}

// Local Storage
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

function getFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error('Storage error:', e);
    return defaultValue;
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Storage error:', e);
  }
}

// Profanity filter (basic)
function filterProfanity(text) {
  const profanities = ['damn', 'hell', 'crap']; // Expand as needed
  let filtered = text;
  profanities.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  return filtered;
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showMessage('Copied to clipboard!', 'success');
  });
}

// Sleep (utility for delays)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Error handling
function handleError(error) {
  console.error('Error:', error);
  let message = 'An error occurred. Please try again.';
  if (error.code === 'PERMISSION_DENIED') {
    message = 'Permission denied';
  } else if (error.code === 'FAILED_PRECONDITION') {
    message = error.message || 'Operation not allowed';
  } else if (error.message) {
    message = error.message;
  }
  showMessage(message, 'error');
  notificationHaptic('error');
}

// Retry with exponential backoff
async function retryAsync(fn, maxAttempts = 3, delay = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await sleep(delay * Math.pow(2, i));
    }
  }
}
