#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { ProcessManager } from './process-manager.js';

const manager = new ProcessManager({ stateDir: '.spp' });

function parseArgs(rawArgs) {
  const options = {};
  const positional = [];

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rawArgs[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
      continue;
    }

    positional.push(arg);
  }

  return { options, positional };
}

function parseEnvEntries(entries = []) {
  const env = {};

  for (const entry of entries) {
    const [key, ...valueParts] = String(entry).split('=');
    if (!key) {
      continue;
    }
    env[key] = valueParts.join('=');
  }

  return env;
}

async function main() {
  const [command, ...rawArgs] = process.argv.slice(2);

  if (!command) {
    console.log('Usage: spp <start|stop|restart|list|logs>');
    process.exit(1);
  }

  if (command === 'list') {
    const apps = manager.listApps();
    console.log(JSON.stringify(apps, null, 2));
    return;
  }

  if (command === 'start') {
    const { options, positional } = parseArgs(rawArgs);
    const script = positional[0] ?? options.script;

    if (!script) {
      console.log('You must provide a script to start.');
      process.exit(1);
    }

    const app = await manager.startApp({
      id: options.name ?? basename(script),
      script: resolve(script),
      args: positional.slice(1),
      cwd: options.cwd ?? process.cwd(),
      env: parseEnvEntries(options.env ? [options.env] : []),
    });

    console.log(JSON.stringify(app, null, 2));
    return;
  }

  if (command === 'stop') {
    const id = rawArgs[0];
    if (!id) {
      console.log('You must provide an app id to stop.');
      process.exit(1);
    }
    const app = await manager.stopApp(id);
    console.log(JSON.stringify(app, null, 2));
    return;
  }

  if (command === 'restart') {
    const id = rawArgs[0];
    if (!id) {
      console.log('You must provide an app id to restart.');
      process.exit(1);
    }
    const app = await manager.restartApp(id);
    console.log(JSON.stringify(app, null, 2));
    return;
  }

  if (command === 'logs') {
    const id = rawArgs[0];
    if (!id) {
      console.log('You must provide an app id to show logs.');
      process.exit(1);
    }

    const logFile = manager.logPathFor(id);
    try {
      const content = readFileSync(logFile, 'utf8');
      console.log(content || 'No logs yet.');
    } catch {
      console.log(`No logs found for ${id}.`);
    }
    return;
  }

  console.log(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
