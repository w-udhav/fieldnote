#!/usr/bin/env bash
# Build on this machine, copy only the standalone build, and start it on llm-server.
set -euo pipefail

HOST="${FIELDNOTE_HOST:-srijansriv@llm-server.local}"
DEST="${FIELDNOTE_DEST:-fieldnote-udv}"
PORT="${FIELDNOTE_PORT:-43123}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CTRL="$(mktemp -d)/ssh"

cleanup() {
  ssh -o ControlPath="$CTRL" -O exit "$HOST" 2>/dev/null || true
  rm -rf "$(dirname "$CTRL")"
}
trap cleanup EXIT

# One login for rsync and the start command. The first connection asks for the password.
SSH_OPTS=(-o ControlMaster=auto -o ControlPersist=120 -o ControlPath="$CTRL")

open_ssh() {
  ssh "${SSH_OPTS[@]}" -fN "$HOST"
}

usage() {
  cat <<EOF
Usage: scripts/deploy.sh <command>

  build   Build here, copy the standalone build to ${HOST}:~/${DEST}, and start the site and worker
  start   Start the site and worker already on the server (port ${PORT})

The server needs Node on PATH (for example ~/.local/bin). SSH will ask for the password.
EOF
}

build_local() {
  cd "$ROOT"
  npm run build
  rm -rf "$ROOT/.deploy"
  mkdir -p "$ROOT/.deploy/.next"
  cp -a "$ROOT/.next/standalone/." "$ROOT/.deploy/"
  cp -a "$ROOT/.next/static" "$ROOT/.deploy/.next/static"
  if [[ -d "$ROOT/public" ]]; then
    cp -a "$ROOT/public" "$ROOT/.deploy/public"
  fi
  if [[ ! -x "$ROOT/node_modules/esbuild/bin/esbuild" ]]; then
    echo "esbuild is missing. Run npm install on this machine first." >&2
    exit 1
  fi
  "$ROOT/node_modules/esbuild/bin/esbuild" "$ROOT/scripts/notion-llm-worker.ts" \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --outfile="$ROOT/.deploy/worker.js"
  "$ROOT/node_modules/esbuild/bin/esbuild" "$ROOT/scripts/telegram-intake-worker.ts" \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=cjs \
    --outfile="$ROOT/.deploy/telegram-worker.js"
  cp -a "$ROOT/MEMORY.md" "$ROOT/.deploy/MEMORY.md"
}

sync_build() {
  # --delete-after removes the server's old node_modules after the new build is in place.
  # Deleting during the transfer fails on those non-empty directories.
  rsync -az --delete-after --force \
    --exclude data \
    --exclude .env \
    --exclude fieldnote.log \
    --exclude .fieldnote.pid \
    --exclude worker.log \
    --exclude .worker.pid \
    --exclude telegram-worker.log \
    --exclude .telegram-worker.pid \
    -e "ssh ${SSH_OPTS[*]}" \
    "$ROOT/.deploy/" "${HOST}:${DEST}/"
  ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p ~/${DEST}/data"
  if [[ -f "$ROOT/.env" ]]; then
    rsync -az --ignore-existing -e "ssh ${SSH_OPTS[*]}" "$ROOT/.env" "${HOST}:${DEST}/.env"
  fi
  if [[ -d "$ROOT/data" ]]; then
    rsync -az --ignore-existing -e "ssh ${SSH_OPTS[*]}" "$ROOT/data/" "${HOST}:${DEST}/data/"
  fi
}

start_remote() {
  ssh "${SSH_OPTS[@]}" "$HOST" "DEST='${DEST}' PORT='${PORT}' bash -s" << 'EOF'
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$HOME/$DEST"
if [[ ! -f server.js ]]; then
  echo "No build in ~/$DEST. Run scripts/deploy.sh build on your PC first." >&2
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "Node is not on PATH. Install Node 22 under ~/.local and open a new shell." >&2
  exit 1
fi
if [[ -f .fieldnote.pid ]]; then
  old="$(cat .fieldnote.pid || true)"
  if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
    kill "$old" || true
    sleep 1
  fi
fi
HOSTNAME=0.0.0.0 PORT="$PORT" nohup node server.js > fieldnote.log 2>&1 &
echo $! > .fieldnote.pid
echo "Fieldnote listening on port ${PORT} (pid $(cat .fieldnote.pid))"
if [[ -f worker.js ]]; then
  if [[ -f .worker.pid ]]; then
    old="$(cat .worker.pid || true)"
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      kill "$old" || true
      sleep 1
    fi
  fi
  nohup node worker.js > worker.log 2>&1 &
  echo $! > .worker.pid
  echo "Worker started (pid $(cat .worker.pid))"
fi
if [[ -f telegram-worker.js ]]; then
  if [[ -f .telegram-worker.pid ]]; then
    old="$(cat .telegram-worker.pid || true)"
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      kill "$old" || true
      sleep 1
    fi
  fi
  nohup node telegram-worker.js > telegram-worker.log 2>&1 &
  echo $! > .telegram-worker.pid
  echo "Telegram worker started (pid $(cat .telegram-worker.pid))"
fi
EOF
}

case "${1:-}" in
  build)
    build_local
    open_ssh
    sync_build
    start_remote
    ;;
  start)
    open_ssh
    start_remote
    ;;
  *)
    usage
    exit 1
    ;;
esac
