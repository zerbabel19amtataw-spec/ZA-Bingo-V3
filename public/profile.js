// Profile screen management

function showProfileScreen() {
  if (!currentUser) return;
  showScreen('profile');
  loadProfileData(currentUser.uid);
}

function loadProfileData(uid) {
  const playerRef = db.ref(`players/${uid}`);
  setListener('profileData', playerRef.on('value', (snap) => {
    const player = snap.val();
    if (!player) return;

    // Update profile fields
    document.getElementById('avatarEdit').textContent = player.avatar || '👤';
    document.getElementById('displayNameInput').value = player.displayName || '';
    document.getElementById('profileUsername').textContent = `@${player.username || 'user'}`;
    document.getElementById('profileTelegramId').textContent = player.telegramId || '-';
    document.getElementById('phoneInput').value = player.phoneNumber || '';
    document.getElementById('profileBalance').textContent = formatCurrency(player.balance || 0);
    
    // Statistics
    document.getElementById('profileGamesPlayed').textContent = player.gamesPlayed || 0;
    document.getElementById('profileGamesWon').textContent = player.gamesWon || 0;
    
    const winRate = player.gamesPlayed > 0
      ? Math.round((player.gamesWon / player.gamesPlayed) * 100)
      : 0;
    document.getElementById('profileWinRate').textContent = `${winRate}%`;
    document.getElementById('profileTotalWinnings').textContent = formatCurrency(player.totalWinnings || 0);
    document.getElementById('profileJoinDate').textContent = formatDate(player.registrationDate);
    
    // Referral code
    document.getElementById('referralCode').textContent = player.referralCode || 'LOADING';
  }));
}

function updateDisplayName() {
  if (!currentUser) return;
  const newName = document.getElementById('displayNameInput').value.trim();
  if (!newName || newName.length < 1 || newName.length > 50) {
    showMessage('Display name must be 1-50 characters', 'error');
    return;
  }

  const playerRef = db.ref(`players/${currentUser.uid}`);
  playerRef.update({ displayName: newName })
    .then(() => {
      showMessage('Display name updated', 'success');
      haptic('light');
    })
    .catch(error => handleError(error));
}

function updatePhone() {
  if (!currentUser) return;
  const phone = document.getElementById('phoneInput').value.trim();
  if (phone && !validatePhoneNumber(phone)) {
    showMessage('Invalid phone number format', 'error');
    return;
  }

  const playerRef = db.ref(`players/${currentUser.uid}`);
  playerRef.update({ phoneNumber: phone || null })
    .then(() => {
      showMessage('Phone number updated', 'success');
      haptic('light');
    })
    .catch(error => handleError(error));
}

function updateAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;

  // For simplicity, we'll use a data URL (in production, upload to storage)
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // For now, just use emoji avatars (full image upload would need Cloud Storage)
    // But we'll update the field to support it
    const firstChar = document.getElementById('displayNameInput').value.charAt(0).toUpperCase();
    const emoji = firstChar.match(/[A-Z]/) ? firstChar : '👤';
    
    const playerRef = db.ref(`players/${currentUser.uid}`);
    playerRef.update({ avatar: emoji })
      .then(() => {
        document.getElementById('avatarEdit').textContent = emoji;
        showMessage('Avatar updated', 'success');
        haptic('light');
      })
      .catch(error => handleError(error));
  };
  reader.readAsDataURL(file);
}

function copyReferralCode() {
  const code = document.getElementById('referralCode').textContent;
  copyToClipboard(code);
  haptic('light');
}
