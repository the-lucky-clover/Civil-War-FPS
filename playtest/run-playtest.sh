#!/bin/bash
# Gettysburg FPS — automated playtest runner.
# Starts the game server, waits for health, runs the bot playtest, cleans up.
set -u
cd "$(dirname "$0")/.."

PORT=3000
SRV_PATTERN="[t]sx server.ts"

# Clear any stale server from a previous run (kill $! only gets the npx
# wrapper; the tsx child survives and would poison room state).
pkill -f "$SRV_PATTERN" 2>/dev/null
fuser -k ${PORT}/tcp 2>/dev/null
sleep 1

echo "▶ Starting game server..."
npx tsx server.ts > playtest/server.log 2>&1 &
SRV=$!

cleanup() {
  kill $SRV 2>/dev/null
  pkill -f "$SRV_PATTERN" 2>/dev/null
}
trap cleanup EXIT

echo "▶ Waiting for server health..."
for i in $(seq 1 40); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "  server healthy"
    break
  fi
  if [ $i -eq 40 ]; then echo "❌ server failed to start — see playtest/server.log"; exit 2; fi
  sleep 1
done

echo "▶ Running bot playtest..."
node playtest/bot-playtest.mjs "ws://localhost:$PORT"
CODE=$?
echo "▶ Playtest exit code: $CODE"
exit $CODE
