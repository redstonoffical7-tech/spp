# SPP

SPP is a lightweight PM2-inspired process manager for local Node.js apps.

It gives you the core workflow people expect from PM2, but in a small and easy-to-understand project:

- start a script as a managed background process
- list all tracked apps
- inspect app logs
- stop or restart a process
- persist basic process metadata in a local state file

## Why SPP?

SPP is designed to be a clean, minimal alternative to heavy runtime managers. It focuses on the essentials: manage processes, keep state, and inspect logs without adding unnecessary complexity.

## Install and use

```bash
cd /workspaces/spp
npm install
node src/cli.js start examples/echo.js --name demo --cwd .
node src/cli.js list
node src/cli.js logs demo
node src/cli.js stop demo
```

## Available commands

```bash
node src/cli.js start <script> --name <app-name>
node src/cli.js list
node src/cli.js logs <app-name>
node src/cli.js stop <app-name>
node src/cli.js restart <app-name>
```

## Project structure

- `src/process-manager.js` — process lifecycle logic
- `src/cli.js` — command-line interface
- `examples/echo.js` — sample app used for testing and demos
- `test/manager.test.js` — regression tests for start/stop behavior

## Current status

This is an MVP focused on the core PM2-style workflow. It is intentionally small and easy to extend, making it a strong starting point for building a more complete production process manager later.
