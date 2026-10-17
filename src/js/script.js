const USERNAME_KEY = 'sampLauncherUsername';

function getCurrentUsername() {
  const input = document.getElementById('usernameInput');
  return input ? input.value.trim() : '';
}

function getUsernameValidationMessage(username) {
  if (username.length < 3 || username.length > 20) {
    return 'O nome de usuário deve ter entre 3 e 20 caracteres.';
  }

  return '';
}

function setDisplayedUsername(value) {
  const display = document.getElementById('usernameDisplay');
  const input = document.getElementById('usernameInput');
  const username = value.trim();

  if (display) display.textContent = username;
  if (input) input.value = username;

  if (username) {
    localStorage.setItem(USERNAME_KEY, username);
  } else {
    localStorage.removeItem(USERNAME_KEY);
  }
}

function playAlertSound() {
  try {
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(680, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.06,
      audioContext.currentTime + 0.02,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.18,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {}
}

const usernameButton = document.getElementById('username');
const usernameInput = document.getElementById('usernameInput');
const savedUsername = localStorage.getItem(USERNAME_KEY) || '';

if (usernameInput) usernameInput.value = savedUsername;
setDisplayedUsername(savedUsername);

if (usernameButton && usernameInput) {
  usernameButton.addEventListener('click', () => {
    const isHidden = usernameInput.classList.contains('hidden');

    if (isHidden) {
      usernameInput.classList.remove('hidden');
      usernameInput.focus();
      usernameInput.select();
    } else {
      const username = usernameInput.value.trim();
      const validationMessage = getUsernameValidationMessage(username);

      if (validationMessage) {
        showBootstrapAlert(validationMessage, 'warning');
        usernameInput.focus();
        return;
      }

      setDisplayedUsername(username);
      usernameInput.classList.add('hidden');
    }
  });

  usernameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const username = usernameInput.value.trim();
      const validationMessage = getUsernameValidationMessage(username);

      if (validationMessage) {
        showBootstrapAlert(validationMessage, 'warning');
        usernameInput.focus();
        return;
      }

      setDisplayedUsername(username);
      usernameInput.classList.add('hidden');
    }
  });

  usernameInput.addEventListener('blur', () => {
    const username = usernameInput.value.trim();
    const validationMessage = getUsernameValidationMessage(username);

    if (validationMessage) {
      showBootstrapAlert(validationMessage, 'warning');
      return;
    }

    setDisplayedUsername(username);
    usernameInput.classList.add('hidden');
  });
}

function showBootstrapAlert(message, type = 'danger') {
  const container = document.getElementById('alertContainer');
  if (!container) return;

  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-alert custom-alert-${type} show`;
  alertDiv.setAttribute('role', 'alert');
  alertDiv.textContent = message;

  container.innerHTML = '';
  container.appendChild(alertDiv);
  playAlertSound();

  setTimeout(() => {
    alertDiv.style.animation = 'alertOut 0.2s ease forwards';
    setTimeout(() => {
      alertDiv.remove();
    }, 200);
  }, 1500);
}

document.getElementById('config').addEventListener('click', async () => {
  const configButton = document.getElementById('config');
  const overlay = document.createElement('div');
  const spinner = document.createElement('div');

  overlay.className = 'loading-overlay';
  spinner.className = 'spinner';

  configButton.disabled = true;
  document.body.appendChild(overlay);
  document.body.appendChild(spinner);

  try {
    const res = await window.electronAPI.selectGTAPath();
    if (res?.error) showBootstrapAlert(res.error, 'danger');
    else if (res?.gtaPath)
      showBootstrapAlert('GTA Path salvo: ' + res.gtaPath, 'success');
  } finally {
    configButton.disabled = false;
    overlay.remove();
    spinner.remove();
  }
});

function renderServerCard(server, index) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-box">
      <h2 id="srv${index + 1}-name">${server.name || `Servidor ${index + 1}`}</h2>
      <p id="srv${index + 1}-players">Carregando...</p>
      <button id="srv${index + 1}-connect" class="server-button">Conectar</button>
    </div>
  `;
  return card;
}

async function loadServers() {
  const res = await window.electronAPI.getConfig();
  const servers = Array.isArray(res?.servers) ? res.servers : [];
  const list = document.getElementById('serverList');

  if (!list) return;
  list.innerHTML = '';

  if (servers.length === 0) {
    showBootstrapAlert(
      'Nenhum servidor configurado, por favor, contate o desenvolvedor.',
      'warning',
    );
    return;
  }

  servers.forEach((srv, index) => {
    const card = renderServerCard(srv, index);
    list.appendChild(card);
  });

  for (let i = 0; i < servers.length; i++) {
    let srv = servers[i];
    let seName = document.getElementById(`srv${i + 1}-name`);
    let sePlayers = document.getElementById(`srv${i + 1}-players`);
    let seConn = document.getElementById(`srv${i + 1}-connect`);

    if (!seName || !sePlayers || !seConn) continue;

    let srvInfo = await window.electronAPI.queryServer(srv.ip, srv.port);
    if (!srvInfo || srvInfo.hostname == undefined) {
      seName.innerText = 'Servidor offline';
      sePlayers.style.display = 'none';
      seConn.style.display = 'none';
    } else {
      seName.innerText = srvInfo.hostname;
      sePlayers.innerText = `${srvInfo.players}/${srvInfo.maxplayers}`;
      seConn.addEventListener('click', async () => {
        if (seConn.dataset.started === 'true') {
          const result = await window.electronAPI.stopServer();
          if (result?.error) showBootstrapAlert(result.error, 'danger');
          return;
        }

        const username = getCurrentUsername();
        const validationMessage = getUsernameValidationMessage(username);

        if (validationMessage) {
          showBootstrapAlert(validationMessage, 'danger');
          return;
        }

        const result = await window.electronAPI.connectServer(
          srv.ip,
          srv.port,
          username,
        );
        if (result?.error) {
          showBootstrapAlert(result.error, 'danger');
          return;
        }

        seConn.dataset.started = 'true';
        seConn.textContent = 'Sair';
        seConn.classList.add('is-exit');
        document.querySelectorAll('.server-button').forEach((button) => {
          if (button !== seConn) button.disabled = true;
        });
      });
    }
  }
}

async function refreshServers() {
  const activeButton = [...document.querySelectorAll('.server-button')].find(
    (button) => button.dataset.started === 'true',
  );
  const activeButtonId = activeButton?.id;

  await loadServers();

  if (!activeButtonId) return;

  const currentActiveButton = document.getElementById(activeButtonId);
  if (!currentActiveButton) return;

  currentActiveButton.dataset.started = 'true';
  currentActiveButton.textContent = 'Sair';
  currentActiveButton.classList.add('is-exit');
  document.querySelectorAll('.server-button').forEach((button) => {
    if (button !== currentActiveButton) button.disabled = true;
  });
}

const reloadButton = document.getElementById('reloadServers');
reloadButton.addEventListener('click', async () => {
  reloadButton.disabled = true;
  reloadButton.classList.add('is-loading');

  try {
    await refreshServers();
  } catch (error) {
    showBootstrapAlert('Não foi possível atualizar os servidores.', 'danger');
  } finally {
    reloadButton.disabled = false;
    reloadButton.classList.remove('is-loading');
  }
});

window.electronAPI.onServerProcessExited(() => {
  document.querySelectorAll('.server-button').forEach((button) => {
    button.dataset.started = 'false';
    button.textContent = 'Conectar';
    button.classList.remove('is-exit');
    button.disabled = false;
  });
});

loadServers();
