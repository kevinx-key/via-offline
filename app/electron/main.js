// VIA offline desktop shell.
//
// Loads the locally built VIA web app (./dist) from a loopback HTTP server so
// WebHID still gets a "secure context". Everything the app needs is bundled:
// keyboard definitions, fonts, the Draco decoder.
//
// Nothing in this process talks to the internet:
//   * Chromium background services (component updater, dictionary download,
//     safe-browsing pings, DNS prefetch) are switched off;
//   * the resolver refuses every host except loopback;
//   * any request that still tries to leave 127.0.0.1 is cancelled.
//
// Smoke test (headless, exits on its own):
//   VIA_SMOKE_TEST=1 VIA_SMOKE_OUT=report.json VIA-Offline.exe
const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  screen,
  dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {createStaticServer} = require(
  fs.existsSync(path.join(__dirname, 'server.js')) ? './server' : '../server',
);
const {GlobalCapture} = require('./global-capture');
const APP_START = Date.now();

// --- keep the Chromium side from reaching the network at all --------------
// `redirector.gvt1.com` (spellcheck dictionary) was the only thing we ever saw
// leaving the process, but these switches also cover the component updater,
// domain reliability, sync, pings and DNS prefetch.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch('dns-prefetch-disable');
// Every host resolves to NOTFOUND, loopback stays reachable. This makes an
// accidental network call fail instantly instead of leaving the machine.
app.commandLine.appendSwitch(
  'host-resolver-rules',
  'MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
);

const DIST = process.env.VIA_DIST
  ? path.resolve(process.env.VIA_DIST)
  : path.join(
      __dirname,
      fs.existsSync(path.join(__dirname, 'dist')) ? 'dist' : '..',
      fs.existsSync(path.join(__dirname, 'dist')) ? '' : 'dist',
    );

// Green/portable builds: keep settings next to the executable when possible.
//   Windows portable (electron-builder) injects PORTABLE_EXECUTABLE_DIR
//   Linux AppImage exposes APPIMAGE = path to the .AppImage file
// A plain folder build can opt into green/portable data by dropping a
// `portable.marker` next to the executable.
const executableDir = path.dirname(process.execPath);
const folderPortable =
  fs.existsSync(path.join(executableDir, 'portable.marker')) &&
  !process.execPath.includes('electron.exe');
const portableRoot =
  process.env.PORTABLE_EXECUTABLE_DIR ||
  (process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : '') ||
  (folderPortable ? executableDir : '');
if (portableRoot) {
  try {
    const dataDir = path.join(portableRoot, 'VIA-Offline-Data');
    fs.mkdirSync(dataDir, {recursive: true});
    app.setPath('userData', dataDir);
    app.setPath('sessionData', dataDir);
  } catch (e) {
    console.error('portable data dir not usable, falling back to default:', e.message);
  }
}
// Only one copy may run. The portable launcher extracts to a fresh temp folder
// every time, so without this lock every double-click would create a second
// full app (and a second HID session).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

// Set VIA_ALLOW_UNKNOWN_DEVICES=1 to talk to keyboards without a bundled
// definition at all (same trade-off as VIA's own "unknown device" mode).
const ALLOW_UNKNOWN_DEVICES = process.env.VIA_ALLOW_UNKNOWN_DEVICES === '1';

// Devices the user explicitly picked once. Persisted next to the portable data
// so an older / non-standard board is recognised again after a restart without
// asking for permission every time.
let grantsFile = '';
let persistedGrants = new Set();
let mainWindow = null;

function loadPersistedGrants() {
  try {
    grantsFile = path.join(app.getPath('userData'), 'hid-grants.json');
    const parsed = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    persistedGrants = new Set(
      (Array.isArray(parsed) ? parsed : []).map((value) => Number(value)),
    );
  } catch {
    persistedGrants = new Set();
  }
}

function persistGrant(vpid) {
  persistedGrants.add(Number(vpid));
  if (!grantsFile) return;
  try {
    fs.writeFileSync(grantsFile, JSON.stringify([...persistedGrants], null, 2));
  } catch (error) {
    console.warn('could not persist HID grant:', error.message);
  }
}

/** Native HID chooser used when Chromium asks for a device. */
/** Re-open the chooser so Chromium enumerates HID devices again. */
function scheduleHidRescan() {
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents
      .executeJavaScript(
        'navigator.hid.requestDevice({filters: []}).then(() => null).catch(() => null)',
        true,
      )
      .catch((error) => {
        console.warn('HID rescan request failed:', error.message);
      });
  }, 300);
}

function showHidPicker(parent, devices) {
  const zh = String(app.getLocale() || '').toLowerCase().startsWith('zh');
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      width: 560,
      height: 620,
      minWidth: 460,
      minHeight: 420,
      parent,
      modal: true,
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      title: zh ? '选择键盘' : 'Select keyboard',
      backgroundColor: '#0d1117',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'hid-picker-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    let settled = false;
    const cleanup = () => {
      for (const channel of [
        'hid-picker:list',
        'hid-picker:choose',
        'hid-picker:rescan',
        'hid-picker:cancel',
      ]) {
        ipcMain.removeHandler(channel);
      }
    };
    const finish = (deviceId) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(deviceId || null);
      if (!picker.isDestroyed()) picker.close();
    };

    ipcMain.handle('hid-picker:list', () =>
      (devices || []).map((device, index) => ({
        deviceId: device.deviceId ?? String(index),
        name: device.name || device.productName || '',
        vendorId: device.vendorId,
        productId: device.productId,
        serialNumber: device.serialNumber || '',
      })),
    );
    ipcMain.handle('hid-picker:choose', (_event, deviceId) => finish(deviceId));
    ipcMain.handle('hid-picker:rescan', () => finish('__rescan__'));
    ipcMain.handle('hid-picker:cancel', () => finish(null));

    picker.on('closed', () => finish(null));
    picker.webContents.on('did-fail-load', () => finish(null));
    picker.once('ready-to-show', () => picker.show());
    picker.loadFile(path.join(__dirname, 'hid-picker.html'), {
      query: {lang: zh ? 'zh' : 'en'},
    });
  });
}

/** Build the vendorId*65536+productId set from the bundled definitions index. */
function loadSupportedIds() {
  const ids = new Set();
  try {
    const defs = JSON.parse(fs.readFileSync(path.join(DIST, 'definitions', 'supported_kbs.json'), 'utf8'));
    for (const v of ['v2', 'v3']) {
      for (const id of defs.vendorProductIds?.[v] ?? []) ids.add(Number(id));
    }
  } catch (e) {
    console.error('failed to read bundled definitions:', e.message);
  }
  return ids;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createStaticServer(DIST);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function allowHidDevices(ses, supportedIds, options = {}) {
  const granted = new Set();
  const vpid = (device) => Number(device.vendorId) * 65536 + Number(device.productId);

  ses.setPermissionCheckHandler((_wc, permission) => permission === 'hid');
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'hid'));

  // Devices with a bundled definition are granted up front, so
  // navigator.hid.getDevices() already lists the keyboard the moment it is
  // plugged in. Devices the user picked manually are remembered too.
  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'hid') return false;
    if (ALLOW_UNKNOWN_DEVICES) return true;

    const id = vpid(details.device);
    if (supportedIds.has(id) || persistedGrants.has(id) || granted.has(id)) {
      granted.add(id);
      return true;
    }
    return false;
  });

  // VIA calls navigator.hid.requestDevice() only when the user clicks
  // "选择键盘" (or asks for the full HID list). Show a real chooser instead of
  // silently picking the first device; the smoke test auto-picks so it stays
  // headless.
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const list = details.deviceList || [];
    if (!list.length) {
      callback(null);
      if (!options.autoPick && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: zh ? '没有发现可选择的设备' : 'No selectable device found',
          message: zh
            ? '系统没有向本程序报告任何 HID 设备。'
            : 'The system did not report any HID device to this app.',
          detail: zh
            ? '请确认键盘已插好，并换一个 USB 口或数据线重试。\n如果设备管理器里能看到键盘，但这里仍为空，通常是键盘固件没有启用 VIA / QMK Raw HID 接口。'
            : 'Check that the keyboard is connected and try another USB port or cable.\nIf Device Manager sees it but this list stays empty, its firmware probably does not expose the VIA / QMK Raw HID interface.',
          buttons: [zh ? '知道了' : 'OK'],
        });
      }
      return;
    }
    if (options.autoPick) {
      const pick =
        list.find((device) => supportedIds.has(vpid(device))) || list[0];
      granted.add(vpid(pick));
      persistGrant(vpid(pick));
      callback(pick.deviceId);
      return;
    }
    showHidPicker(mainWindow, list)
      .then((deviceId) => {
        if (deviceId === '__rescan__') {
          // End the current WebHID request, then open a fresh one. Chromium
          // enumerates HID devices again for the new request, so a keyboard
          // plugged in after the first popup appears in the new list.
          callback(null);
          scheduleHidRescan();
          return;
        }
        const picked = list.find((device) => device.deviceId === deviceId);
        if (picked) {
          granted.add(vpid(picked));
          persistGrant(vpid(picked));
        }
        callback(picked ? picked.deviceId : null);
        if (picked) {
          // Let Chromium finish granting the device before the renderer scans.
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('hid:selection-changed', {
                allowUnsupported: true,
              });
            }
          }, 150);
        }
      })
      .catch((error) => {
        console.error('HID picker failed:', error);
        callback(null);
      });
  });
}

// --- global keyboard capture / window integration -------------------------
const globalCapture = new GlobalCapture({
  helperPath: path.join(__dirname, 'keyhook.exe'),
});
let captureWindow = null;
let capturePreviousAlwaysOnTop = false;
let nativeIpcReady = false;

function restoreCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.setAlwaysOnTop(capturePreviousAlwaysOnTop, 'floating');
    if (process.platform === 'darwin') {
      captureWindow.setVisibleOnAllWorkspaces(false);
    }
  }
  captureWindow = null;
}

function setupNativeIpc() {
  if (nativeIpcReady) return;
  nativeIpcReady = true;

  globalCapture.on('key', (payload) => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.webContents.send('global-capture:key', payload);
    }
  });
  globalCapture.on('ready', (payload) => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.webContents.send('global-capture:ready', payload);
    }
  });
  globalCapture.on('emergency', () => {
    // The helper exits itself; the exit handler performs the cleanup.
  });
  globalCapture.on('ended', (payload) => {
    const target = captureWindow;
    restoreCaptureWindow();
    if (target && !target.isDestroyed()) {
      target.webContents.send('global-capture:ended', payload || {});
    }
  });

  ipcMain.handle('global-capture:start', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = globalCapture.start(process.pid);
    if (!result.ok || !win) {
      return {...result, active: false};
    }
    // Do not claim success until the helper has actually installed the hook.
    // This avoids the "capturing" badge with an invisible, non-top window when
    // the helper file is missing or blocked.
    const ready = await globalCapture.waitForReady(2500);
    if (!ready) {
      globalCapture.stop();
      return {
        ok: false,
        active: false,
        error:
          'Global capture failed to start. Check whether security software blocked keyhook, or run as administrator.',
      };
    }
    captureWindow = win;
    capturePreviousAlwaysOnTop = win.isAlwaysOnTop();
    win.setAlwaysOnTop(true, 'screen-saver');
    try {
      win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});
    } catch {
      // Windows does not implement workspaces; always-on-top is enough.
    }
    win.show();
    win.focus();
    return {...result, active: true};
  });

  ipcMain.handle('global-capture:stop', () => {
    globalCapture.stop();
    restoreCaptureWindow();
    return {ok: true, active: false};
  });

  ipcMain.handle('window:always-on-top', (event, value) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return {ok: false};
    win.setAlwaysOnTop(!!value, 'floating');
    return {ok: true, value: !!value};
  });

  ipcMain.handle('window:set-zoom', (event, value) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return {ok: false};
    const factor = Math.min(1.5, Math.max(0.75, Number(value) || 1));
    win.webContents.setZoomFactor(factor);
    return {ok: true, value: factor};
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return {ok: false};
    win.minimize();
    return {ok: true};
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return {ok: false};
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return {ok: true, maximized: win.isMaximized()};
  });

  ipcMain.handle('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    return {ok: !!win, maximized: win ? win.isMaximized() : false};
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return {ok: false};
    win.close();
    return {ok: true};
  });
}

async function createWindow() {
  loadPersistedGrants();
  const port = await startServer();
  const origin = `http://127.0.0.1:${port}`;
  const smokeTest = process.env.VIA_SMOKE_TEST === '1';

  // Size in DIPs, never larger than the actual work area. This is what makes
  // the UI look "zoomed" on a 125%/150% Windows display: a fixed 1360x900 DIP
  // window can exceed a 1920x1080 panel and Chromium then scales everything.
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const initialWidth = Math.max(960, Math.min(1440, workArea.width - 80));
  const initialHeight = Math.max(640, Math.min(920, workArea.height - 80));

  const win = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: Math.min(960, Math.max(720, workArea.width - 20)),
    minHeight: Math.min(640, Math.max(520, workArea.height - 40)),
    useContentSize: true,
    center: true,
    title: `VIA 离线版 · K-STAR ${
      app.getVersion() === '0.0.0' ? '' : 'v' + app.getVersion()
    }`.trim(),
    show: !smokeTest && process.env.VIA_HIDE_WINDOW !== '1',
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // No spellchecker: that is what pulled en-us-*.bdic from gvt1.com.
      spellcheck: false,
    },
  });
  mainWindow = win;
  const sendMaximized = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:maximized', win.isMaximized());
    }
  };
  win.on('maximize', sendMaximized);
  win.on('unmaximize', sendMaximized);
  win.once('ready-to-show', () => {
    if (process.env.VIA_STARTUP_OUT) {
      try {
        fs.writeFileSync(
          process.env.VIA_STARTUP_OUT,
          JSON.stringify({
            appStart: APP_START,
            ready: Date.now(),
            deltaMainMs: Date.now() - APP_START,
          }),
        );
      } catch {
        // diagnostics only
      }
    }
  });
  win.on('closed', () => {
    if (captureWindow === win) {
      globalCapture.stop();
      restoreCaptureWindow();
    }
    if (mainWindow === win) mainWindow = null;
  });

  const ses = win.webContents.session;
  ses.setSpellCheckerEnabled(false);
  ses.setSpellCheckerLanguages([]);
  allowHidDevices(ses, loadSupportedIds(), {autoPick: smokeTest});

  // Hard guard: anything that is not the local app gets cancelled.
  const externalRequests = [];
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || '';
    const local =
      url.startsWith(origin) ||
      url.startsWith('devtools://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      // The native HID chooser is a local file loaded into a modal window.
      (url.startsWith('file://') && url.includes('hid-picker.html')) ||
      url.startsWith('chrome-extension://');
    if (!local) {
      externalRequests.push(url);
      callback({cancel: true});
      return;
    }
    callback({});
  });

  // Keep the app inside its own little world: external links go to the OS browser.
  win.webContents.setWindowOpenHandler(({url}) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return {action: 'deny'};
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  if (smokeTest) {
    // Post-build patches can change a bundle without changing its filename;
    // never let a previous smoke run's HTTP cache mask the new file.
    await ses.clearCache();
  }
  await win.loadURL(origin + (process.env.VIA_SMOKE_ROUTE || '/'));

  // Keyboard diagnostic: write down every HID device the renderer can see and
  // whether a bundled definition exists for it. Used by 诊断-键盘.cmd.
  if (process.env.VIA_FRAME_DIAG === '1') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const before = win.isMaximized();
    const controls = await win.webContents.executeJavaScript(`({
      header: Math.round(document.querySelector('header')?.getBoundingClientRect().height || 0),
      drag: getComputedStyle(document.querySelector('header')).webkitAppRegion,
      buttons: [...document.querySelectorAll('header button')].map((el) => el.getAttribute('title') || '').filter(Boolean),
      rootTop: Math.round((document.getElementById('root')?.getBoundingClientRect().top) || 0),
    })`);
    await win.webContents.executeJavaScript('window.viaNative.toggleMaximizeWindow()');
    await new Promise((resolve) => setTimeout(resolve, 700));
    const maximized = win.isMaximized();
    await win.webContents.executeJavaScript('window.viaNative.toggleMaximizeWindow()');
    const report = {before, maximized, controls};
    const out = process.env.VIA_FRAME_DIAG_OUT || path.join(os.tmpdir(), 'via-frame-diag.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('FRAME_DIAG ' + JSON.stringify(report));
    app.exit(0);
    return;
  }

  if (process.env.VIA_3D_DIAG === '1') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await win.webContents.executeJavaScript(
      `(() => {
        const raw = JSON.parse(localStorage.getItem('via-app-store') || '{}');
        raw.settings = {...(raw.settings || {}), renderMode: '3D'};
        localStorage.setItem('via-app-store', JSON.stringify(raw));
        return true;
      })()`,
    );
    win.reload();
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const report = await win.webContents.executeJavaScript(`({
      webgl: !!document.createElement('canvas').getContext('webgl'),
      text: (document.body.innerText || '').slice(0, 800),
      authorize: (document.body.innerText || '').includes('Authorize device'),
      choose: (document.body.innerText || '').includes('选择键盘'),
    })`);
    const out = process.env.VIA_3D_DIAG_OUT || path.join(os.tmpdir(), 'via-3d-diag.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('3D_DIAG ' + JSON.stringify(report));
    app.exit(0);
    return;
  }

  if (process.env.VIA_CAPTURE_DIAG === '1') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const startResult = await win.webContents.executeJavaScript(
      `(() => {
        const button = [...document.querySelectorAll('button')].find((el) =>
          (el.textContent || '').includes('开启全局拦截'),
        );
        if (!button) return {ok: false, error: 'button not found'};
        button.click();
        return {ok: true, clicked: true};
      })()`,
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const during = await win.webContents.executeJavaScript(
      `({text: (document.body.innerText || '').includes('拦截中')})`,
    );
    during.windowAlwaysOnTop = win.isAlwaysOnTop();
    const stopResult = await win.webContents.executeJavaScript(
      `(() => {
        const button = [...document.querySelectorAll('button')].find((el) =>
          (el.textContent || '').includes('停止拦截'),
        );
        if (!button) return {ok: false, error: 'stop button not found'};
        button.click();
        return {ok: true, clicked: true};
      })()`,
      true,
    );
    const report = {startResult, during, stopResult};
    const out = process.env.VIA_CAPTURE_DIAG_OUT || path.join(os.tmpdir(), 'via-capture-diag.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('CAPTURE_DIAG ' + JSON.stringify(report));
    app.exit(0);
    return;
  }

  if (process.env.VIA_DEFINITION_DIAG === '1') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const report = await win.webContents.executeJavaScript(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const importFile = async (name, text) => {
        const input = document.querySelector('input[type=file]');
        if (!input) return {error: 'no file input'};
        const file = new File([text], name, {type: 'application/json'});
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
        await sleep(700);
        return {text: document.body.innerText};
      };
      const v2 = await fetch('/definitions/v2/105185281.json').then((r) => r.text());
      const v3 = await fetch('/definitions/v3/1077979750.json').then((r) => r.text());
      const first = await importFile('old-v2.json', v2);
      const second = await importFile('old-v3.json', v3);
      return {
        firstHasV2: (first.text || '').includes('V2') && (first.text || '').includes('已自动识别'),
        firstError: (first.text || '').includes('无法识别'),
        secondHasV3: (second.text || '').includes('V3') && (second.text || '').includes('已自动识别'),
        secondError: (second.text || '').includes('无法识别'),
        snippet: (second.text || '').split('\\n').slice(-24),
      };
    })()`);
    const out = process.env.VIA_DEFINITION_DIAG_OUT || path.join(os.tmpdir(), 'via-definition-diag.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('DEFINITION_DIAG ' + JSON.stringify(report));
    app.exit(0);
    return;
  }

  if (process.env.VIA_UI_DIAG === '1') {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const report = await win.webContents.executeJavaScript(`(async () => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
      };
      const header = document.querySelector('header');
      const navLabels = [...document.querySelectorAll('nav .label')].map((el) => el.textContent);
      const themeButton = [...document.querySelectorAll('button')].find((el) => {
        const label = (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '');
        return label.includes('模式') || label.toLowerCase().includes('mode');
      });
      const beforeTheme = document.documentElement.dataset.themeMode;
      if (themeButton) themeButton.click();
      await new Promise((r) => setTimeout(r, 100));
      const afterTheme = document.documentElement.dataset.themeMode;
      const captureButton = [...document.querySelectorAll('button')].find((el) => (el.textContent || '').includes('全局拦截') || (el.textContent || '').includes('interception'));
      const deviceButton = [...document.querySelectorAll('button')].find((el) => (el.textContent || '').includes('选择键盘') || (el.textContent || '').includes('Select keyboard'));
      const bodyStyle = getComputedStyle(document.body);
      const controls = [...document.querySelectorAll('button')].slice(0, 12).map((el) => {
        const r = el.getBoundingClientRect();
        return {text: (el.textContent || '').trim().slice(0, 24), h: Math.round(r.height), font: getComputedStyle(el).fontSize};
      });
      return {
        route: location.pathname,
        theme: {before: beforeTheme, after: afterTheme},
        layout: {
          viewport: {w: innerWidth, h: innerHeight},
          header: rect('header'),
          nav: rect('nav'),
          keyboardArea: rect('#root > div'),
          content: rect('main'),
          bodyScrollWidth: document.body.scrollWidth,
          rootScrollWidth: document.documentElement.scrollWidth,
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        },
        font: {body: bodyStyle.fontSize, family: bodyStyle.fontFamily.slice(0, 80)},
        selection: {
          body: bodyStyle.userSelect,
          textNodes: [...document.querySelectorAll('div, p, span')].filter(
            (el) => getComputedStyle(el).userSelect === 'text',
          ).length,
        },
        colors: {
          bodyBg: bodyStyle.backgroundColor,
          bodyText: bodyStyle.color,
          headerBg: header ? getComputedStyle(header).backgroundColor : null,
          accent: getComputedStyle(document.documentElement).getPropertyValue('--color_accent').trim(),
          label: getComputedStyle(document.documentElement).getPropertyValue('--color_label').trim(),
        },
        navLabels,
        hasThemeButton: !!themeButton,
        hasCaptureButton: !!captureButton,
        hasDeviceButton: !!deviceButton,
        native: {
          present: !!window.viaNative,
          platform: window.viaNative?.platform,
          isElectron: window.viaNative?.isElectron,
        },
        controls,
        text: (document.body.innerText || '').slice(0, 500),
        headerChildren: [...(header?.children || [])].map((el) => {
          const r = el.getBoundingClientRect();
          return {tag: el.tagName, cls: el.className.slice(0, 40), x: Math.round(r.x), w: Math.round(r.width)};
        }),
        rootChildren: [...(document.getElementById('root')?.children || [])].map((el) => {
          const r = el.getBoundingClientRect();
          return {tag: el.tagName, cls: el.className.slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
        }),
        overflowing: [...document.querySelectorAll('body *')]
          .map((el) => ({el, r: el.getBoundingClientRect()}))
          .filter(({r}) => r.width > 0 && r.right > innerWidth + 1)
          .sort((a, b) => b.r.right - a.r.right)
          .slice(0, 8)
          .map(({el, r}) => ({
            tag: el.tagName,
            cls: String(el.className).slice(0, 50),
            right: Math.round(r.right),
            w: Math.round(r.width),
            pos: getComputedStyle(el).position,
          })),
        topRight: (() => {
          const bars = [...document.querySelectorAll('header > *')];
          const last = bars[bars.length - 1];
          if (!last) return null;
          const r = last.getBoundingClientRect();
          return {x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width)};
        })(),
      };
    })()`);
    const out = process.env.VIA_UI_DIAG_OUT || path.join(os.tmpdir(), 'via-ui-diag.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('UI_DIAG ' + JSON.stringify(report));
    app.exit(0);
    return;
  }

  if (process.env.VIA_HID_DIAG === '1') {
    const supportedIds = loadSupportedIds();
    const devices = await win.webContents.executeJavaScript(`(async () => {
      const list = await navigator.hid.getDevices();
      return list.map((d) => ({
        name: d.productName || '',
        vendorId: d.vendorId,
        productId: d.productId,
        collections: (d.collections || []).map((c) => ({usagePage: c.usagePage, usage: c.usage})),
      }));
    })()`);
    const report = {
      time: new Date().toISOString(),
      bundledDefinitionCount: supportedIds.size,
      visibleHidDevices: devices.map((d) => {
        const id = Number(d.vendorId) * 65536 + Number(d.productId);
        const qmk = d.collections.some(
          (c) => (c.usagePage === 0xff60 && c.usage === 0x61) || (c.usagePage === 0xff31 && c.usage === 0x74),
        );
        return {
          ...d,
          vid: '0x' + Number(d.vendorId).toString(16).padStart(4, '0'),
          pid: '0x' + Number(d.productId).toString(16).padStart(4, '0'),
          vpid: id,
          qmkRawHid: qmk,
          definitionBundled: supportedIds.has(id),
        };
      }),
    };
    const out = process.env.VIA_HID_DIAG_OUT || path.join(os.tmpdir(), 'via-hid-diag.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('HID_DIAG ' + JSON.stringify(report));
    app.exit(0);
    return;
  }

  if (smokeTest) {
    try {
      const report = await win.webContents.executeJavaScript(`(async () => {
        const defs = await fetch('/definitions/supported_kbs.json').then((r) => r.json());
        const id = defs.vendorProductIds.v3[0];
        const one = await fetch('/definitions/v3/' + id + '.json').then((r) => r.status);
        // Prove that an outbound request cannot succeed.
        let blockedProbe = 'unknown';
        try {
          await fetch('https://redirector.gvt1.com/edgedl/chrome/dict/en-us-10-1.bdic', {mode: 'no-cors'});
          blockedProbe = 'NOT-blocked';
        } catch (e) {
          blockedProbe = 'blocked';
        }
        // Prove the HID chooser is wired up: without a handler this call hangs
        // forever, which is exactly how "no keyboard found" looks in VIA.
        let hidProbe = 'unknown';
        try {
          const granted = await Promise.race([
            navigator.hid.requestDevice({filters: [{usagePage: 0xff60, usage: 0x61}]}),
            new Promise((res) => setTimeout(() => res('timeout'), 4000)),
          ]);
          hidProbe = granted === 'timeout' ? 'timeout' : 'resolved:' + granted.length;
        } catch (e) {
          hidProbe = 'rejected:' + e.message;
        }
        return {
          title: document.title,
          mounted: document.querySelector('#root')?.children.length || 0,
          v2: defs.vendorProductIds.v2.length,
          v3: defs.vendorProductIds.v3.length,
          sampleDefinitionStatus: one,
          hidApi: typeof navigator.hid,
          origin: location.origin,
          externalFetchProbe: blockedProbe,
          hidRequestDeviceProbe: hidProbe,
        };
      })()`);

      await new Promise((r) => setTimeout(r, 2000)); // let lazy requests show up
      if (process.env.VIA_SMOKE_SHOT) {
        const shot = await win.webContents.capturePage();
        fs.writeFileSync(process.env.VIA_SMOKE_SHOT, shot.toPNG());
      }
      // The probe above is expected to appear here - everything else is a bug.
      report.blockedRequests = externalRequests.filter((u) => !u.includes('redirector.gvt1.com'));
      report.probeBlocked = externalRequests.some((u) => u.includes('redirector.gvt1.com'));
      report.dist = {
        path: DIST,
        exists: fs.existsSync(DIST),
        sample: fs.existsSync(path.join(DIST, 'definitions', 'v3', '1077979750.json')),
        files: fs.existsSync(path.join(DIST, 'definitions', 'v3'))
          ? fs.readdirSync(path.join(DIST, 'definitions', 'v3')).length
          : -1,
      };

      const outFile = process.env.VIA_SMOKE_OUT || path.join(os.tmpdir(), 'via-offline-smoke.json');
      fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
      console.log('SMOKE_TEST ' + JSON.stringify(report));
      const ok =
        report.mounted > 0 &&
        report.sampleDefinitionStatus === 200 &&
        report.blockedRequests.length === 0 &&
        report.probeBlocked;
      app.exit(ok ? 0 : 1);
    } catch (e) {
      console.error('SMOKE_TEST_FAILED ' + e.message);
      app.exit(1);
    }
    return;
  }

  const viewMenu = {
    label: 'View',
    submenu: [
      {role: 'reload'},
      {role: 'forceReload'},
      {role: 'toggleDevTools'},
      {type: 'separator'},
      {role: 'resetZoom'},
      {role: 'zoomIn'},
      {role: 'zoomOut'},
      {type: 'separator'},
      {role: 'togglefullscreen'},
    ],
  };
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      process.platform === 'darwin'
        ? [{role: 'appMenu'}, {role: 'editMenu'}, viewMenu]
        : [viewMenu],
    ),
  );
}

app.whenReady()
  .then(() => {
    if (!gotSingleInstanceLock) return;
    setupNativeIpc();
    return createWindow();
  })
  .catch((e) => {
    console.error(e);
    app.exit(2);
  });

app.on('before-quit', () => {
  globalCapture.dispose();
});

app.on('window-all-closed', () => app.quit());


