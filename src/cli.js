#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { ProcessManager } from './process-manager.js';

const manager = new ProcessManager({ stateDir: '.spp' });

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  white: '\u001b[37m',
  red: '\u001b[91m',
};

const LOGO = `
$$$$$$$\  $$$$$$$\  $$$$$$$\  
$$  __$$\ $$  __$$\ $$  __$$\ 
$$ /  \__|$$ |  $$ |$$ |  $$ |
\$$$$$$\  $$$$$$$  |$$$$$$$  |
 \____$$\ $$  ____/ $$  ____/ 
$$\   $$ |$$ |      $$ |      
\$$$$$$  |$$ |      $$ |      
 \______/ \__|      \__|      
`;

const DEV = 'developed and built by  -  ';

function printBanner() {
  const banner = `${ANSI.bold}${ANSI.cyan}${LOGO}${ANSI.reset}`;
  const footer = `${ANSI.bold}${ANSI.white}${DEV}${ANSI.red}${ANSI.bold}redstone${ANSI.reset}`;
  console.log(`\n${banner}\n${footer}\n`);
}

function printHelp() {
  printBanner();
  console.log('SPP helps you start, stop, and watch Node.js apps.\n');
  console.log('Commands:');
  console.log('  spp start <script.js> --name my-app');
  console.log('  spp list');
  console.log('  spp status <app-name>');
  console.log('  spp stop <app-name>');
  console.log('  spp restart <app-name>');
  console.log('  spp logs <app-name>');
  console.log('  spp help\n');
}

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

function lxcStateFromStatus(value) {
  const normalized = String(value ?? 'offline').toLowerCase();
  return normalized === 'online' ? 'RUNNING' : 'STOPPED';
}

function lxcTable(rows) {
  const columns = ['NAME', 'STATE', 'PID', 'COMMAND'];
  const values = rows.map((row) => ({
    name: String(row.name ?? 'unknown'),
    state: lxcStateFromStatus(row.state ?? row.status ?? 'offline'),
    pid: String(row.pid ?? '—'),
    command: String(row.command ?? row.cmd ?? 'n/a'),
  }));

  const widths = columns.map((column, index) => {
    const others = values.map((row) => String(Object.values(row)[index] ?? ''));
    return Math.max(column.length, ...others.map((value) => value.length));
  });

  const render = (cells) => `| ${cells.map((cell, index) => String(cell).padEnd(widths[index])).join(' | ')} |`;
  const border = `+-${widths.map((width) => '-'.repeat(width + 2)).join('-+-')}-+`;

  const header = render(columns);
  const lines = [border, header, border, ...values.map((row) => render([
    row.name,
    row.state,
    row.pid,
    row.command,
  ])), border];

  return lines.join('\n');
}

async function showList() {
  const managed = manager.listApps();

  if (managed.length === 0) {
    console.log('No SPP apps yet.');
    return;
  }

  const rows = managed.map((app) => ({
    name: app.id,
    status: app.status || 'offline',
    pid: app.pid ?? '—',
    command: app.script || 'node',
  }));

  console.log('\nSPP process list\n');
  console.log(lxcTable(rows));
}

async function main() {
  const [command, ...rawArgs] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === '--install-banner') {
    printBanner();
    return;
  }

  if (command === 'list') {
    await showList();
    return;
  }

  if (command === 'status') {
    const id = rawArgs[0];
    if (!id) {
      console.log('Use: spp status <app-name>');
      return;
    }
    const status = manager.getStatus(id);
    console.log(`${id}: ${status}`);
    return;
  }

  if (command === 'start') {
    const { options, positional } = parseArgs(rawArgs);
    const script = positional[0] ?? options.script;

    if (!script) {
      console.log('Need a script to start. Example: spp start server.js --name web');
      return;
    }

    const app = await manager.startApp({
      id: options.name ?? basename(script),
      script: resolve(script),
      args: positional.slice(1),
      cwd: options.cwd ?? process.cwd(),
      env: parseEnvEntries(options.env ? [options.env] : []),
    });

    console.log(`Started: ${app.id}`);
    console.log(lxcTable([{ name: app.id, status: app.status, pid: app.pid ?? '—', command: app.script }]));
    return;
  }

  if (command === 'stop') {
    const id = rawArgs[0];
    if (!id) {
      console.log('Use: spp stop <app-name>');
      return;
    }

    const app = await manager.stopApp(id);
    console.log(`Stopped: ${id}`);
    console.log(lxcTable([{ name: app.id || id, status: app.status || 'offline', pid: app.pid ?? '—', command: app.script || 'process' }]));
    return;
  }

  if (command === 'restart') {
    const id = rawArgs[0];
    if (!id) {
      console.log('Use: spp restart <app-name>');
      return;
    }

    const app = await manager.restartApp(id);
    console.log(`Restarted: ${app.id}`);
    console.log(lxcTable([{ name: app.id, status: app.status, pid: app.pid ?? '—', command: app.script }]));
    return;
  }

  if (command === 'logs') {
    const id = rawArgs[0];
    if (!id) {
      console.log('Use: spp logs <app-name>');
      return;
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
  console.log('Try: spp help');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
