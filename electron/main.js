/**
 * Gettysburg Civil War FPS — Electron main process.
 *
 * The .dmg ships the whole battlefield: this process starts the game's own
 * Node server (the same server.ts that powers multiplayer) on a free local
 * port, waits until it answers /api/health, then opens the game in a
 * desktop window pointed at it.
 *
 * Hosting a multiplayer game: your server runs on your machine. Friends
 * join by entering your "host:port" in the lobby's remote-server field.
 * (On a LAN it just works; over the internet you'll need port forwarding
 * or a VPN like Tailscale.)
 */
const { app, BrowserWindow, Menu, dialog } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const net = require('net');
const http = require('http');

// Use the real GPU: don't let Chromium's software fallback list kick in.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let serverChild = null;
let mainWindow = null;
let gamePort = 3000;

function findFreePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const probe = net.createServer();
      probe.once('error', () => tryPort(p + 1));
      probe.once('listening', () => probe.close(() => resolve(p)));
      probe.listen(p, '127.0.0.1');
    };
    tryPort(start);
  });
}

function serverEntryPath() {
  // Dev: <repo>/electron/main.js -> <repo>/dist/server.cjs
  // Packaged: <resources>/app/electron/main.js -> <resources>/app/dist/server.cjs
  return path.join(__dirname, '..', 'dist', 'server.cjs');
}

function startGameServer(port) {
  return new Promise((resolve, reject) => {
    const entry = serverEntryPath();
    serverChild = fork(entry, [], {
      execPath: process.execPath,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    serverChild.stdout.on('data', (d) => console.log('[server]', d.toString().trim()));
    serverChild.stderr.on('data', (d) => console.error('[server]', d.toString().trim()));
    serverChild.on('error', reject);
    serverChild.on('exit', (code) => {
      if (mainWindow && code !== 0) {
        console.error(`Game server exited with code ${code}`);
      }
    });

    // Wait for the health endpoint
    const deadline = Date.now() + 25000;
    const poll = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/api/health', timeout: 2000 },
        (res) => {
          if (res.statusCode === 200) return resolve();
          if (Date.now() > deadline) return reject(new Error('server health check timed out'));
          setTimeout(poll, 400);
        }
      );
      req.on('error', () => {
        if (Date.now() > deadline) return reject(new Error('game server did not start'));
        setTimeout(poll, 400);
      });
    };
    setTimeout(poll, 800);
  });
}

const RESOLUTION_PRESETS = [
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1600 × 900', width: 1600, height: 900 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '2560 × 1440', width: 2560, height: 1440 },
];

function applyResolution(width, height) {
  if (!mainWindow) return;
  if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  mainWindow.setSize(width, height);
  mainWindow.center();
}

function toggleFullscreen() {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

function buildMenu() {
  const template = [
    {
      label: 'Game',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: toggleFullscreen,
        },
        { type: 'separator' },
        ...RESOLUTION_PRESETS.map((p) => ({
          label: `Window: ${p.label}`,
          click: () => applyResolution(p.width, p.height),
        })),
        { type: 'separator' },
        {
          label: 'Maximize Window',
          click: () => mainWindow && mainWindow.maximize(),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Gettysburg — Civil War FPS',
    backgroundColor: '#0a0806',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  buildMenu();
  mainWindow.loadURL(`http://127.0.0.1:${gamePort}/`);
  // Launch maximized so the battlefield fills the desktop on any monitor.
  mainWindow.maximize();
  mainWindow.show();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function shutdown() {
  if (serverChild) {
    try {
      serverChild.kill('SIGTERM');
    } catch {}
    serverChild = null;
  }
}

app.on('window-all-closed', () => {
  shutdown();
  app.quit();
});

app.on('before-quit', shutdown);

app.whenReady().then(async () => {
  try {
    gamePort = await findFreePort(3000);
    await startGameServer(gamePort);
    createWindow();
  } catch (err) {
    console.error('Failed to start Gettysburg:', err);
    dialog.showErrorBox(
      'Gettysburg failed to start',
      `The battlefield server could not start:\n${err.message}`
    );
    shutdown();
    app.quit();
  }
});
