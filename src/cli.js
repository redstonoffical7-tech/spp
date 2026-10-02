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
};

const LOGO = `
  ███████╗██████╗ ███████╗
  ██╔════╝██╔══██╗██╔════╝
  ███████╗██████╔╝█████╗  
  ╚════██╗██╔═══╝ ██╔══╝  
  ███████║██║     ███████╗
  ╚══════╝╚═╝     ╚══════╝
`;

const DEV = 'developed and built by  -  redstone';

function printBanner() {
  const banner = `${ANSI.bold}${ANSI.cyan}${LOGO}${ANSI.reset}`;
  const footer = `${ANSI.bold}${ANSI.white}${DEV}${ANSI.reset}`;
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

function toTable(rows) {
  const columns = ['NAME', 'STATUS', 'PID', 'CMD'];
  const values = rows.map((row) => ({
    name: String(row.name ?? 'unknown'),
    status: String(row.status ?? 'offline'),
    pid: String(row.pid ?? '—'),
    cmd: String(row.cmd ?? 'n/a'),
  }));

  const widths = columns.map((column, index) => {
    const longest = values.reduce((max, row) => {
      const text = Object.values(row)[index];
      return Math.max(max, text.length);
    }, column.length);
    return longest;
  });

  const formatRow = (row) => {
    const cells = [
      row.name.padEnd(widths[0]),
      row.status.padEnd(widths[1]),
      row.pid.padEnd(widths[2]),
      row.cmd,
    ];
    return `  ${cells.join('  ')}`;
  };

  const header = formatRow({
    name: columns[0].padEnd(widths[0]),
    status: columns[1].padEnd(widths[1]),
    pid: columns[2].padEnd(widths[2]),
    cmd: columns[3],
  });

  const divider = `  ${widths.map((width) => '-'.repeat(width + 2)).join(' ')}`;
  const lines = [header, divider, ...values.map(formatRow)];
  return lines.join('\n');
}

function getDetectedNodeProcesses() {
  try {
    const output = execSync('ps -eo pid,comm,args --no-headers', { encoding: 'utf8' });
    return output
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\S+)\s+(.*)$/);
        if (!match) {
          return null;
        }

        const [, pid, command, args] = match;
        const text = `${command} ${args}`.trim();
        if (!text.includes('node') && !/node.*\.(js|mjs|cjs)/.test(text)) {
          return null;
        }

        return {
          pid: Number(pid),
          name: command,
          cmd: args || command,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function showList() {
  const managed = manager.listApps();
  const managedMap = new Map(managed.map((app) => [String(app.id), app]));
  const seen = new Set();
  const rows = [];

  for (const app of managed) {
    seen.add(String(app.pid ?? app.id));
    rows.push({
      name: app.id,
      status: app.status || 'offline',
      pid: app.pid ?? '—',
      cmd: app.script || 'node',
    });
  }

  for (const proc of getDetectedNodeProcesses()) {
    const pidKey = String(proc.pid);
    if (seen.has(pidKey)) {
      continue;
    }

    rows.push({
      name: proc.name,
      status: 'online',
      pid: proc.pid,
      cmd: proc.cmd,
    });
  }

  if (rows.length === 0) {
    console.log('No Node.js processes found right now.');
    return;
  }

  console.log('\nSPP process list\n');
  console.log(toTable(rows));
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
    console.log(toTable([{ name: app.id, status: app.status, pid: app.pid ?? '—', cmd: app.script }]));
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
    console.log(toTable([{ name: app.id || id, status: app.status || 'offline', pid: app.pid ?? '—', cmd: app.script || 'process' }]));
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
    console.log(toTable([{ name: app.id, status: app.status, pid: app.pid ?? '—', cmd: app.script }]));
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
