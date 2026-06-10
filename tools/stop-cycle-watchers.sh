#!/bin/bash
# stop-cycle-watchers.sh
# Stops background handoff watchers
# Usage: bash tools/stop-cycle-watchers.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDOFF_DIR="$REPO_ROOT/.handoff"
PID_FILE="$HANDOFF_DIR/.watcher-pids"

if [ ! -f "$PID_FILE" ]; then
  echo "[cycle-watchers] No PID file found. Watchers may not be running."
  exit 0
fi

while IFS= read -r PID; do
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "[cycle-watchers] Stopped watcher PID $PID"
  else
    echo "[cycle-watchers] PID $PID already stopped"
  fi
done < "$PID_FILE"

rm -f "$PID_FILE"
echo "[cycle-watchers] All watchers stopped."
