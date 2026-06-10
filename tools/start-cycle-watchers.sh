#!/bin/bash
# start-cycle-watchers.sh
# Starts both handoff watchers in background before beginning a mission cycle
# Usage: bash tools/start-cycle-watchers.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDOFF_DIR="$REPO_ROOT/.handoff"

echo "[cycle-watchers] Starting handoff watchers..."
echo "[cycle-watchers] Repo root: $REPO_ROOT"

rm -f "$HANDOFF_DIR/.impl-summary-processed"
rm -f "$HANDOFF_DIR/.gate2-processed"
echo "[cycle-watchers] Sentinels reset."

bash "$REPO_ROOT/tools/watch-handoff.sh" >> "$HANDOFF_DIR/.watch-handoff.log" 2>&1 &
HANDOFF_PID=$!
echo "[cycle-watchers] watch-handoff.sh started (PID $HANDOFF_PID)"

bash "$REPO_ROOT/tools/watch-gate2.sh" >> "$HANDOFF_DIR/.watch-gate2.log" 2>&1 &
GATE2_PID=$!
echo "[cycle-watchers] watch-gate2.sh started (PID $GATE2_PID)"

echo "$HANDOFF_PID" > "$HANDOFF_DIR/.watcher-pids"
echo "$GATE2_PID" >> "$HANDOFF_DIR/.watcher-pids"

echo "[cycle-watchers] Both watchers running. Logs:"
echo "  $HANDOFF_DIR/.watch-handoff.log"
echo "  $HANDOFF_DIR/.watch-gate2.log"
echo "[cycle-watchers] To stop: bash tools/stop-cycle-watchers.sh"
