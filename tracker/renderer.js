// UIの状態更新ロジック
window.electronAPI.onUpdateState((state) => {
  document.getElementById('levelDisplay').innerText = `LV.${state.level}`;
  document.getElementById('xpDisplay').innerText = `${state.xp} XP`;
  
  const progressPercentage = ((state.xp % 100) / 100) * 100;
  document.getElementById('xpFill').style.width = `${progressPercentage}%`;

  document.getElementById('saveQuest').innerText = `${state.quests.saves}/5`;
  document.getElementById('exportQuest').innerText = `${state.quests.exports}/1`;
});

window.electronAPI.onNewLog((log) => {
  const container = document.getElementById('logContainer');
  const el = document.createElement('div');
  el.style.marginBottom = '5px';
  
  const color = log.type === 'Save' ? '#00f2ff' : '#ff2d55';
  el.innerHTML = `<span style="color:${color}; font-weight:bold;">[${log.type}]</span> +${log.xp}XP : ${log.file}`;
  
  container.prepend(el);
  
  // 最大10件まで保持
  if (container.children.length > 10) {
    container.removeChild(container.lastChild);
  }
});

// ログイン・ログアウトUI制御
const loginOverlay = document.getElementById('loginOverlay');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');

loginBtn.addEventListener('click', async () => {
  loginError.innerText = '';
  const email = emailInput.value;
  const password = passwordInput.value;
  
  if (!email || !password) {
    loginError.innerText = 'Please enter email and password';
    return;
  }
  
  loginBtn.innerText = 'Logging in...';
  loginBtn.disabled = true;
  
  const result = await window.electronAPI.login(email, password);
  
  loginBtn.innerText = 'Login';
  loginBtn.disabled = false;
  
  if (result && result.error) {
    loginError.innerText = result.error;
  }
});

logoutBtn.addEventListener('click', () => {
  window.electronAPI.logout();
});

window.electronAPI.onAuthStateChanged((user) => {
  if (user) {
    loginOverlay.classList.add('hidden');
    document.getElementById('statusBadge').innerText = '● Monitoring';
    document.getElementById('statusBadge').style.color = '#39ff14';
    document.getElementById('statusBadge').style.borderColor = '#39ff14';
    document.getElementById('statusBadge').style.background = 'rgba(57, 255, 20, 0.2)';
  } else {
    loginOverlay.classList.remove('hidden');
    document.getElementById('statusBadge').innerText = '○ Stopped';
    document.getElementById('statusBadge').style.color = '#aaa';
    document.getElementById('statusBadge').style.borderColor = '#555';
    document.getElementById('statusBadge').style.background = 'rgba(255, 255, 255, 0.05)';
  }
});
