// Windows global keyboard capture: run the low-level hook helper and stream
// its JSON lines to the renderer. The helper itself suppresses every key.
//
// Packaged builds also ship `keyhook.bin` (the same executable with a neutral
// extension). Some antivirus products delete or quarantine an unsigned .exe
// while the portable archive is being unpacked; copying the .bin to a fresh
// temp file at start time gives us a second, much more reliable path.
const {spawn} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {EventEmitter} = require('events');

class GlobalCapture extends EventEmitter {
  constructor(options = {}) {
    super();
    this.helperPath =
      options.helperPath || path.join(__dirname, 'keyhook.exe');
    this.helperBinPath =
      options.helperBinPath || path.join(__dirname, 'keyhook.bin');
    this.extraArgs = Array.isArray(options.extraArgs) ? options.extraArgs : [];
    this.child = null;
    this.stopRequested = false;
    this.buffer = '';
    this.heartbeat = null;
    this.tempHelperPath = null;
    this.readyWait = null;
    this.readyResolve = null;
  }

  get active() {
    return !!this.child;
  }

  /** Prefer the neutral-extension copy, because an unsigned .exe inside the
   * portable extraction is the file most likely to be removed by AV. */
  prepareHelper() {
    const copyBin = () => {
      if (!fs.existsSync(this.helperBinPath)) return null;
      const target = path.join(
        os.tmpdir(),
        `kstar-keyhook-${process.pid}-${Date.now()}.exe`,
      );
      // readFile/writeFile also works when helperBinPath lives inside app.asar;
      // copyFileSync is less reliable across Electron's asar layer.
      fs.writeFileSync(target, fs.readFileSync(this.helperBinPath));
      this.tempHelperPath = target;
      return target;
    };
    this.tempHelperPath = null;
    const copied = copyBin();
    if (copied) return copied;
    if (fs.existsSync(this.helperPath)) return this.helperPath;
    throw new Error(
      `keyhook helper not found: ${this.helperPath} (keyhook.bin is also missing)`,
    );
  }

  start(parentPid) {
    if (process.platform !== 'win32') {
      return {ok: false, error: 'Global capture is currently Windows-only'};
    }
    if (this.child) {
      return {ok: false, error: 'Global capture is already running'};
    }
    let helper;
    try {
      helper = this.prepareHelper();
    } catch (error) {
      return {ok: false, error: error.message};
    }

    let child;
    try {
      child = spawn(
        helper,
        [...this.extraArgs, '--parent', String(parentPid || process.pid)],
        {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
    } catch (error) {
      this.cleanupTempHelper();
      return {ok: false, error: `Could not start the key hook: ${error.message}`};
    }
    this.child = child;
    this.stopRequested = false;
    this.buffer = '';
    this.readyWait = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.consume(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (text) => {
      const message = String(text).trim();
      if (message) this.emit('stderr', message);
    });

    child.on('error', (error) => {
      this.resolveReady(false);
      this.emit('ended', {error: error.message});
      this.cleanup();
    });
    child.on('exit', (code) => {
      const wasRequested = this.stopRequested;
      this.resolveReady(false);
      this.cleanup();
      this.emit('ended', {
        error: wasRequested
          ? null
          : code === 0
            ? null
            : `The key hook exited (code ${code}). If security software blocked it, allow this app to run.`,
      });
    });

    // The helper exits on its own if these heartbeats stop, so a renderer or
    // main-process crash can never leave the keyboard swallowed.
    this.heartbeat = setInterval(() => {
      if (this.child && this.child.stdin.writable) {
        try {
          this.child.stdin.write('PING\n');
        } catch {
          // The exit handler will clean up.
        }
      }
    }, 1500);

    return {ok: true};
  }

  /** Resolves true only after the helper confirms the hook is installed. */
  waitForReady(timeoutMs = 2500) {
    if (!this.readyWait) return Promise.resolve(false);
    return Promise.race([
      this.readyWait,
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
  }

  resolveReady(value) {
    if (this.readyResolve) {
      const resolve = this.readyResolve;
      this.readyResolve = null;
      resolve(value);
    }
  }

  consume(chunk) {
    this.buffer += chunk;
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (!message || typeof message !== 'object') continue;
      if (message.type === 'ready') {
        this.resolveReady(true);
        this.emit('ready', message);
      } else if (message.type === 'down' || message.type === 'up') {
        this.emit('key', message);
      } else if (message.type === 'emergency') {
        this.emit('emergency');
      } else if (message.type === 'error') {
        this.resolveReady(false);
        this.emit('ended', {error: message.message || 'The key hook failed to start'});
        this.stop();
      }
    }
  }

  stop() {
    this.stopRequested = true;
    const child = this.child;
    if (!child) {
      this.cleanupTempHelper();
      return;
    }
    try {
      if (child.stdin.writable) child.stdin.write('STOP\n');
    } catch {
      // ignore
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // already gone
      }
    }, 250);
    timer.unref?.();
    this.cleanup(true);
  }

  cleanupTempHelper() {
    if (!this.tempHelperPath) return;
    const target = this.tempHelperPath;
    this.tempHelperPath = null;
    setTimeout(() => {
      try {
        fs.unlinkSync(target);
      } catch {
        // The file may still be mapped by the exiting child.
      }
    }, 1200).unref?.();
  }

  cleanup(keepChild = false) {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (!keepChild) {
      this.child = null;
      this.cleanupTempHelper();
    }
  }

  dispose() {
    this.stop();
  }
}

module.exports = {GlobalCapture};
