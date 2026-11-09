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
const {app, BrowserWindow, Menu, shell} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {createStaticServer} = require('./server');

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

const DIST = path.join(__dirname, 'dist');

// Green/portable builds: keep settings next to the executable when possible.
//   Windows portable (electron-builder) injects PORTABLE_EXECUTABLE_DIR
//   Linux AppImage exposes APPIMAGE = path to the .AppImage file
const portableRoot =
  process.env.PORTABLE_EXECUTABLE_DIR ||
  (process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : '');
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
// Set VIA_ALLOW_UNKNOWN_DEVICES=1 to talk to keyboards without a bundled
// definition at all (same trade-off as VIA's own "unknown device" mode).
const ALLOW_UNKNOWN_DEVICES = process.env.VIA_ALLOW_UNKNOWN_DEVICES === '1';

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

function allowHidDevices(ses, supportedIds) {
  const granted = new Set();
  const vpid = (device) => Number(device.vendorId) * 65536 + Number(device.productId);

  ses.setPermissionCheckHandler((_wc, permission) => permission === 'hid');
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'hid'));

  // Devices with a bundled definition are granted up front, so
  // navigator.hid.getDevices() already lists the keyboard the moment it is
  // plugged in - no chooser, no network, nothing to click.
  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'hid') return false;
    if (ALLOW_UNKNOWN_DEVICES) return true;

    const id = vpid(details.device);
    if (supportedIds.has(id) || granted.has(id)) {
      granted.add(id);
      return true;
    }
    return false;
  });

  // VIA calls navigator.hid.requestDevice() when it has no device yet; Electron
  // has no native picker, so decide here. Prefer a definition-backed keyboard,
  // otherwise fall back to the first QMK-ish device (its request is already
  // filtered to the QMK raw-HID / console usages) and let VIA report it as an
  // unknown keyboard - better than looking dead.
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const list = details.deviceList || [];
    const pick = ALLOW_UNKNOWN_DEVICES
      ? list[0]
      : list.find((d) => supportedIds.has(vpid(d))) || list[0];
    if (pick) {
      granted.add(vpid(pick));
    }
    callback(pick ? pick.deviceId : null);
  });
}

async function createWindow() {
  const port = await startServer();
  const origin = `http://127.0.0.1:${port}`;
  const smokeTest = process.env.VIA_SMOKE_TEST === '1';

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'VIA 离线版 · K-STAR',
    show: !smokeTest,
    autoHideMenuBar: true,
    backgroundColor: '#dadada',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // No spellchecker: that is what pulled en-us-*.bdic from gvt1.com.
      spellcheck: false,
    },
  });

  const ses = win.webContents.session;
  ses.setSpellCheckerEnabled(false);
  ses.setSpellCheckerLanguages([]);
  allowHidDevices(ses, loadSupportedIds());

  // Hard guard: anything that is not the local app gets cancelled.
  const externalRequests = [];
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || '';
    const local =
      url.startsWith(origin) ||
      url.startsWith('devtools://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
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

  await win.loadURL(origin + (process.env.VIA_SMOKE_ROUTE || '/'));

  // Keyboard diagnostic: write down every HID device the renderer can see and
  // whether a bundled definition exists for it. Used by 诊断-键盘.cmd.
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

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
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
      },
    ]),
  );
}

app.whenReady().then(createWindow).catch((e) => {
  console.error(e);
  app.exit(2);
});

app.on('window-all-closed', () => app.quit());


