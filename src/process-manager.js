import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export class ProcessManager {
  constructor({ stateDir = '.spp' } = {}) {
    this.stateDir = resolve(stateDir);
    this.logDir = join(this.stateDir, 'logs');
    this.stateFile = join(this.stateDir, 'state.json');
    this.apps = new Map();

    mkdirSync(this.stateDir, { recursive: true });
    mkdirSync(this.logDir, { recursive: true });
    this.loadState();
  }

  normalizeStatus(status = 'offline') {
    return status === 'online' ? 'online' : 'offline';
  }

  isPidAlive(pid) {
    if (!pid) {
      return false;
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  loadState() {
    if (!existsSync(this.stateFile)) {
      this.persistState();
      return;
    }

    try {
      const raw = readFileSync(this.stateFile, 'utf8');
      const data = JSON.parse(raw);
      for (const app of data.apps ?? []) {
        const isAlive = this.isPidAlive(app.pid);
        this.apps.set(app.id, {
          ...app,
          child: undefined,
          status: isAlive ? 'online' : 'offline',
          pid: isAlive ? app.pid : null,
        });
      }
    } catch {
      this.persistState();
    }
  }

  persistState() {
    const apps = Array.from(this.apps.values()).map(({ child, ...rest }) => ({
      ...rest,
      status: this.normalizeStatus(rest.status),
      pid: rest.pid ?? null,
    }));
    writeFileSync(this.stateFile, JSON.stringify({ apps }, null, 2));
  }

  logPathFor(id) {
    return join(this.logDir, `${id}.log`);
  }

  getStatus(id) {
    const app = this.apps.get(id);
    return app ? this.normalizeStatus(app.status) : 'offline';
  }

  listApps() {
    return Array.from(this.apps.values()).map(({ child, ...rest }) => ({
      ...rest,
      status: this.normalizeStatus(rest.status),
      pid: rest.pid ?? null,
    }));
  }

  async startApp({
    id,
    script,
    args = [],
    cwd = process.cwd(),
    env = {},
  }) {
    const appId = id ?? basename(script);
    const existing = this.apps.get(appId);
    if (existing && existing.status === 'online' && this.isPidAlive(existing.pid)) {
      return { ...existing, status: 'online', pid: existing.pid };
    }

    if (existing && existing.pid && !this.isPidAlive(existing.pid)) {
      existing.status = 'offline';
      existing.pid = null;
    }

    const scriptPath = resolve(script);
    const logFile = this.logPathFor(appId);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const record = {
      id: appId,
      script: scriptPath,
      args,
      cwd,
      env,
      pid: child.pid,
      status: 'online',
      startedAt: new Date().toISOString(),
      logFile,
    };

    const onData = (streamName) => (chunk) => {
      appendFileSync(logFile, chunk);
      const app = this.apps.get(appId);
      if (app) {
        app[`${streamName}Last`] = chunk.toString();
      }
    };

    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));
    child.stdout?.unref();
    child.stderr?.unref();
    child.unref();

    child.on('exit', (code, signal) => {
      const app = this.apps.get(appId);
      if (!app) {
        return;
      }

      app.status = 'offline';
      app.exitCode = code;
      app.signal = signal;
      app.pid = null;
      this.persistState();
    });

    this.apps.set(appId, { ...record, child });
    this.persistState();

    return { ...record };
  }

  async stopApp(id) {
    const app = this.apps.get(id);
    if (!app) {
      return { id, status: 'offline', note: 'not found' };
    }

    if (app.status === 'offline' && !this.isPidAlive(app.pid)) {
      return { ...app, status: 'offline' };
    }

    if (app.child) {
      return new Promise((resolve) => {
        const child = app.child;
        const onExit = () => {
          const record = this.apps.get(id);
          if (record) {
            record.status = 'offline';
            record.pid = null;
            record.stoppedAt = new Date().toISOString();
            this.persistState();
            resolve({ ...record, status: 'offline' });
            return;
          }
          resolve({ id, status: 'offline' });
        };

        child.once('exit', onExit);
        child.kill('SIGTERM');

        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, 1500);
      });
    }

    if (app.pid && this.isPidAlive(app.pid)) {
      process.kill(app.pid, 'SIGTERM');
      setTimeout(() => {
        if (this.isPidAlive(app.pid)) {
          process.kill(app.pid, 'SIGKILL');
        }
      }, 1500);
    }

    app.status = 'offline';
    app.pid = null;
    app.stoppedAt = new Date().toISOString();
    this.persistState();
    return { ...app, status: 'offline' };
  }

  async restartApp(id) {
    const app = this.apps.get(id);
    if (!app) {
      return { id, status: 'offline', note: 'not found' };
    }

    await this.stopApp(id);
    return this.startApp({
      id,
      script: app.script,
      args: app.args,
      cwd: app.cwd,
      env: app.env,
    });
  }
}
