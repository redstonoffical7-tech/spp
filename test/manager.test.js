import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ProcessManager } from '../src/process-manager.js';

const appScript = join(process.cwd(), 'examples', 'echo.js');

test('ProcessManager starts and stops an app', async () => {
  const stateDir = join(mkdtempSync(join(tmpdir(), 'spp-test-')), '.spp');
  const manager = new ProcessManager({ stateDir });

  const started = await manager.startApp({
    id: 'demo',
    script: appScript,
    args: ['hello'],
    cwd: process.cwd(),
    env: { NODE_ENV: 'test' },
  });

  assert.equal(started.status, 'online');
  assert.ok(started.pid > 0);
  assert.equal(manager.listApps().length, 1);

  const stopped = await manager.stopApp('demo');
  assert.equal(stopped.status, 'offline');
  assert.equal(manager.getStatus('demo'), 'offline');
});
