#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/redstonoffical7-tech/spp.git}"
BRANCH="${BRANCH:-main}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Installing it first..."

  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nodejs npm
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache nodejs npm
  else
    echo "Could not detect a supported package manager. Please install Node.js 18+ manually."
    exit 1
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is still missing. Please install Node.js 18+ and try again."
  exit 1
fi

echo "Installing SPP from GitHub..."
npm install -g "git+${REPO_URL}#${BRANCH}"

echo ""
echo "✅ SPP installed successfully."
if command -v spp >/dev/null 2>&1; then
  spp --install-banner || true
fi
echo "Run these next:"
echo "  spp help"
echo "  spp list"
echo "  spp start examples/echo.js --name demo"
