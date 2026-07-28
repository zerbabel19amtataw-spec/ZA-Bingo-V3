function switchWalletTab(tab) {
  document.getElementById('deposit-tab').style.display = 'none';
  document.getElementById('withdraw-tab').style.display = 'none';

  if (tab === 'deposit') {
    document.getElementById('deposit-tab').style.display = 'block';
    document.getElementById('depositForm').style.display = 'none';
  } else if (tab === 'withdraw') {
    document.getElementById('withdraw-tab').style.display = 'block';
  }

  document.querySelectorAll('.wallet-tabs .tab-btn').forEach((btn, i) => {
    btn.classList.toggle(
      'active',
      (i === 0 && tab === 'deposit') ||
      (i === 1 && tab === 'withdraw')
    );
  });

  haptic('light');
}


function selectPaymentMethod(method) {
  const form = document.getElementById('depositForm');

  form.style.display = 'block';
  form.dataset.method = method;

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

    await requestDeposit({
      amount,
      method,
      smsConfirmation
    });

    showMessage(
      'Deposit request submitted. Waiting for approval...',
      'success'
    );

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
    const requestWithdrawal = functionsRef.httpsCallable(
      'requestWithdrawal'
    );

    await requestWithdrawal({
      amount,
      destination
    });

    showMessage(
      'Withdrawal request submitted. Processing...',
      'success'
    );

    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawDest').value = '';

    haptic('success');

  } catch (error) {
    handleError(error);
  }
}


// FIXED: Uses Telegram ID
function loadWalletBalance() {
  const telegramId = String(tg.initDataUnsafe.user.id);

  const playerRef = db.ref(`players/${telegramId}`);

  setListener('walletBalance', playerRef.on('value', (snap) => {

    const player = snap.val();

    if (!player) return;


    document.getElementById('walletBalance').textContent =
      formatCurrency(player.balance || 0);


    if (player.reserved && player.reserved > 0) {

      document.getElementById('walletReserved').textContent =
        `${formatCurrency(player.reserved)} reserved`;

      show('walletReserved');

    } else {

      hide('walletReserved');

    }

  }));
}



// FIXED: Uses Telegram ID
function loadTransactionHistory() {

  const telegramId = String(tg.initDataUnsafe.user.id);

  const transRef = db.ref(`transactions/${telegramId}`);


  setListener('transactions', transRef.on('value', (snap) => {

    const transactions = [];


    snap.forEach((childSnap) => {

      transactions.push({
        id: childSnap.key,
        ...childSnap.val()
      });

    });


    transactions.sort(
      (a, b) => (b.time || 0) - (a.time || 0)
    );


    const list = document.getElementById('transactionsList');


    if (transactions.length === 0) {

      list.innerHTML =
        '<p class="loading">No transactions yet</p>';

      return;

    }


    list.innerHTML = transactions.map(tx => {

      const icon =
        tx.type === 'deposit' ? '📥' :
        tx.type === 'withdrawal' ? '📤' :
        tx.type === 'game_entry' ? '🎮' :
        tx.type === 'prize' ? '🏆' :
        '💰';


      return `
        <div class="transaction-item">

          <div class="transaction-icon">
            ${icon}
          </div>

          <div class="transaction-info">

            <div class="transaction-label">
              ${tx.type}
            </div>

            <div class="transaction-time">
              ${formatTime(tx.time)}
            </div>

          </div>


          <div class="transaction-amount">
            ${formatCurrency(tx.amount || 0)}
          </div>

        </div>
      `;

    }).join('');

  }));
}
