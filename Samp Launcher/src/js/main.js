const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn, execFile, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const query = require('samp-query');

let configPath = path.join(__dirname, 'config.json');
let mainWindow;
let activeGameProcessId = null;
let isLaunchingGame = false;

if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify({ gtaPath: '' }, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function getRunningGameProcessIds() {
  return new Promise((resolve, reject) => {
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq gta_sa.exe', '/FO', 'CSV', '/NH'],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const processIds = [...stdout.matchAll(/"gta_sa\.exe","(\d+)"/gi)].map(
          (match) => Number(match[1]),
        );
        resolve(processIds);
      },
    );
  });
}

function monitorGameProcess(processId) {
  const checkProcess = async () => {
    try {
      const processIds = await getRunningGameProcessIds();
      if (!processIds.includes(processId)) {
        if (activeGameProcessId === processId) {
          activeGameProcessId = null;
          mainWindow?.webContents.send('server-process-exited');
        }
        return;
      }
    } catch (error) {}

    if (activeGameProcessId === processId) {
      setTimeout(checkProcess, 1000);
    }
  };

  setTimeout(checkProcess, 1000);
}

app.whenReady().then(() => {
  createWindow();
});

ipcMain.handle('selectGTAPath', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (result.canceled) return null;

  const folder = result.filePaths[0];
  const sampExe = path.join(folder, 'samp.exe');

  if (!fs.existsSync(sampExe)) {
    return { error: 'samp.exe não encontrado nessa pasta.' };
  }

  fs.writeFileSync(configPath, JSON.stringify({ gtaPath: folder }, null, 2));
  return { gtaPath: folder };
});

ipcMain.handle('getConfig', () => {
  const result = JSON.parse(fs.readFileSync(configPath));
  return result;
});

ipcMain.handle('connectServer', async (event, { ip, port, username }) => {
  if (activeGameProcessId || isLaunchingGame) {
    return { error: 'O SA-MP já está aberto.' };
  }

  const cfg = JSON.parse(fs.readFileSync(configPath));

  const cleanUsername = typeof username === 'string' ? username.trim() : '';

  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return {
      error: 'O nome de usuário deve ter entre 3 e 20 caracteres.',
    };
  }

  if (!cfg.gtaPath) {
    return { error: 'Configure o local do GTA primeiro!' };
  }

  const exe = path.join(cfg.gtaPath, 'samp.exe');
  if (!fs.existsSync(exe)) {
    return { error: 'samp.exe não encontrado na pasta configurada!' };
  }

  if (cleanUsername) {
    try {
      execSync(
        `reg add "HKCU\\Software\\SAMP" /v PlayerName /t REG_SZ /d "${cleanUsername}" /f`,
      );
    } catch (regError) {
      return {
        error: 'Erro ao definir o nome de usuário: ' + regError.message,
      };
    }
  }

  isLaunchingGame = true;

  let existingProcessIds;
  try {
    existingProcessIds = await getRunningGameProcessIds();
  } catch (error) {
    isLaunchingGame = false;
    return { error: 'Não foi possível verificar se o GTA está aberto.' };
  }

  return new Promise((resolve) => {
    let settled = false;
    let launchTimeout;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(launchTimeout);
      isLaunchingGame = false;
      resolve(result);
    };

    const starterProcess = spawn(exe, [`${ip}:${port}`], {
      cwd: cfg.gtaPath,
      windowsHide: true,
    });

    starterProcess.once('error', (error) => {
      finish({ error: 'Não foi possível iniciar o SA-MP: ' + error.message });
    });

    starterProcess.once('spawn', () => {
      const findGameProcess = async () => {
        try {
          const processIds = await getRunningGameProcessIds();
          if (settled) return;

          const newProcessId = processIds.find(
            (processId) => !existingProcessIds.includes(processId),
          );

          if (newProcessId) {
            activeGameProcessId = newProcessId;
            monitorGameProcess(newProcessId);
            finish({ ok: true });
            return;
          }
        } catch (error) {}

        if (!settled) setTimeout(findGameProcess, 500);
      };

      findGameProcess();
      launchTimeout = setTimeout(() => {
        finish({ error: 'Não foi possível detectar o gta_sa.exe.' });
      }, 30000);
    });
  });
});

ipcMain.handle('stopServer', async () => {
  if (!activeGameProcessId) {
    return { error: 'O GTA não está aberto.' };
  }

  return new Promise((resolve) => {
    execFile(
      'taskkill',
      ['/PID', String(activeGameProcessId), '/T', '/F'],
      { windowsHide: true },
      (error) => {
        if (error) {
          resolve({ error: 'Não foi possível fechar o GTA: ' + error.message });
          return;
        }
        resolve({ ok: true });
      },
    );
  });
});

ipcMain.handle('queryServer', async (event, { ip, port }) => {
  return new Promise((resolve) => {
    query({ host: ip, port }, (error, response) => {
      if (error || !response) {
        resolve({ online: false });
      } else {
        resolve({
          online: true,
          hostname: response.hostname,
          players: response.online,
          maxplayers: response.maxplayers,
        });
      }
    });
  });
});
