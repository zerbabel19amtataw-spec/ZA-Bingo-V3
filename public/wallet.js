// Wallet management

function switchWalletTab(tab) {
  // Hide all tabs
  document.getElementById('deposit-tab').style.display = 'none';
  document.getElementById('withdraw-tab').style.display = 'none';
  
  // Show selected tab
  if (tab === 'deposit') {
    document.getElementById('deposit-tab').style.display = 'block';
    document.getElementById('depositForm').style.display = 'none';
  } else if (tab === 'withdraw') {
    document.getElementById('withdraw-tab').style.display = 'block';
  }
  
  // Update tab buttons
  document.querySelectorAll('.wallet-tabs .tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && tab === 'deposit') || (i === 1 && tab === 'withdraw'));
  });
  
  haptic('light');
}

function selectPaymentMethod(method) {
  const form = document.getElementById('depositForm');
  form.style.display = 'block';
  form.dataset.method = method;
  
  // Update instructions (could be more detailed)
  const methodName = method === 'telebirr' ? 'Telebirr' : 'CBE';
  document.querySelector('.payment-methods').style.display = 'none';
  
  haptic('light');
}

function cancelPaymentMethod() {
  document.getElementById('depositForm').style.display = 'none';
  document.querySelector('.payment-methods').style.display = 'grid';
  haptic('light');
}

async function submitDeposit() {
  if (!currentUser) return;

  const amount = Number(document.getElementById('depositAmount').value);
  const smsConfirmation = document.getElementById('depositSMS').value.trim();
  const method = document.getElementById('depositForm').dataset.method;

  if (amount < 50) {
    showMessage('Minimum deposit is 50 Br', 'error');
    return;
  }

  if (!smsConfirmation) {
    showMessage('Please paste the SMS confirmation', 'error');
    return;
  }

  try {
    const requestDeposit = functionsRef.httpsCallable('requestDeposit');
    const { data } = await requestDeposit({ amount, method, smsConfirmation });
    
    showMessage('Deposit request submitted. Waiting for approval...', 'success');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositSMS').value = '';
    cancelPaymentMethod();
    haptic('success');
  } catch (error) {
    handleError(error);
  }
}

async function submitWithdrawal() {
  if (!currentUser) return;

  const amount = Number(document.getElementById('withdrawAmount').value);
  const destination = document.getElementById('withdrawDest').value.trim();

  if (amount < 50) {
    showMessage('Minimum withdrawal is 50 Br', 'error');
    return;
  }

  if (!destination) {
    showMessage('Please enter your phone or account number', 'error');
    return;
  }

  if (!window.playerData || window.playerData.balance < amount) {
    showMessage('Insufficient balance', 'error');
    return;
  }

  try {
    const requestWithdrawal = functionsRef.httpsCallable('requestWithdrawal');
    const { data } = await requestWithdrawal({ amount, destination });
    
    showMessage('Withdrawal request submitted. Processing...', 'success');
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawDest').value = '';
    haptic('success');
  } catch (error) {
    handleError(error);
  }
}

function loadWalletBalance() {
  if (!currentUser) return;

  const playerRef = db.ref(`players/${currentUser.uid}`);
  setListener('walletBalance', playerRef.on('value', (snap) => {
    const player = snap.val();
    if (!player) return;

    document.getElementById('walletBalance').textContent = formatCurrency(player.balance || 0);
    
    if (player.reserved && player.reserved > 0) {
      document.getElementById('walletReserved').textContent = `${formatCurrency(player.reserved)} reserved`;
      show('walletReserved');
    } else {
      hide('walletReserved');
    }
  }));
}

function loadTransactionHistory() {
  if (!currentUser) return;

  const transRef = db.ref(`transactions/${currentUser.uid}`);
  setListener('transactions', transRef.on('value', (snap) => {
    const transactions = [];
    snap.forEach((childSnap) => {
      transactions.push({
        id: childSnap.key,
        ...childSnap.val()
      });
    });

    // Sort by newest first
    transactions.sort((a, b) => (b.time || 0) - (a.time || 0));

    const list = document.getElementById('transactionsList');
    if (transactions.length === 0) {
      list.innerHTML = '<p class="loading">No transactions yet</p>';
      return;
    }

    list.innerHTML = transactions.map(tx => {
      const icon = tx.type === 'deposit' ? '📥' : 
                   tx.type === 'withdrawal' ? '📤' :
                   tx.type === 'game_entry' ? '🎮' :
                   tx.type === 'prize' ? '🏆' : '💰';
      
      const label = tx.type === 'deposit' ? 'Deposit' :
                    tx.type === 'withdrawal' ? 'Withdrawal' :
                    tx.type === 'game_entry' ? 'Game Entry' :
                    tx.type === 'prize' ? 'Prize' : 'Transaction';

      const amountClass = tx.amount > 0 ? 'positive' : 'negative';
      const amountText = tx.amount > 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount);

      return `
        <div class="transaction-item">
          <div class="transaction-icon">${icon}</div>
          <div class="transaction-info">
            <div class="transaction-label">${label}</div>
            <div class="transaction-time">${formatTime(tx.time)}</div>
          </div>
          <div class="transaction-amount ${amountClass}">${amountText}</div>
        </div>
      `;
    }).join('');

    // Add styles if not already in CSS
    if (!document.getElementById('transactionStyles')) {
      const style = document.createElement('style');
      style.id = 'transactionStyles';
      style.textContent = `
        .transaction-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px;
          margin-bottom: 8px;
        }
        .transaction-icon {
          font-size: 24px;
        }
        .transaction-info {
          flex: 1;
        }
        .transaction-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .transaction-time {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .transaction-amount {
          font-weight: 700;
          font-size: 13px;
        }
        .transaction-amount.positive {
          color: var(--accent-green);
        }
        .transaction-amount.negative {
          color: var(--accent-red);
        }
      `;
      document.head.appendChild(style);
    }
  }));
}

// Initialize wallet listeners when needed
document.addEventListener('DOMContentLoaded', () => {
  const depositBtn = document.getElementById('screen-wallet');
  if (depositBtn) {
    const observer = new MutationObserver(() => {
      if (document.getElementById('screen-wallet').classList.contains('active')) {
        loadWalletBalance();
      }
    });
    observer.observe(document.getElementById('screen-wallet'), { attributes: true });
  }
  
  const transBtn = document.getElementById('screen-transactions');
  if (transBtn) {
    const observer = new MutationObserver(() => {
      if (document.getElementById('screen-transactions').classList.contains('active')) {
        loadTransactionHistory();
      }
    });
    observer.observe(document.getElementById('screen-transactions'), { attributes: true });
  }
});
