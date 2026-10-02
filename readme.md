# SPP

SPP is a simple, friendly PM2-style process manager for local Node.js apps.

It is built to be easy enough for beginners to understand, but useful enough for everyday process management.

## What SPP does

- start a script as a managed background process
- list running or offline apps in a simple table
- show logs for a process
- stop an app without deleting it from the list
- restart an app with one command
- keep basic state locally in `.spp/`

## The SPP logo

```text
  ███████╗██████╗ ███████╗
  ██╔════╝██╔══██╗██╔════╝
  ███████╗██████╔╝█████╗  
  ╚════██╗██╔═══╝ ██╔══╝  
  ███████║██║     ███████╗
  ╚══════╝╚═╝     ╚══════╝
```

Developed and built by  -  redstone

## Install

For a VPS or Linux server:

```bash
curl -fsSL https://raw.githubusercontent.com/redstonoffical7-tech/spp/main/install.sh | sudo bash
```

For local development:

```bash
cd /workspaces/spp
npm install
```

After installation, run `spp help` to see the logo and commands.

## Commands

```bash
spp help
spp list
spp start examples/echo.js --name demo
spp status demo
spp logs demo
spp stop demo
spp restart demo
```

## Notes

This project is intentionally small and easy to extend. It focuses on the most important PM2-style actions without overcomplicating the tool.
