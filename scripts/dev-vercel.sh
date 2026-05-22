#!/usr/bin/env bash
# Launch `vercel dev` after killing any leftover dev servers on the
# ports it cycles through (3000, 3001, 3002). Without this cleanup,
# `vercel dev` falls back to the next free port (e.g. 3002), which
# usually still works but breaks bookmarks / muscle-memory at :3000.
#
# Safe-by-default: only kills processes bound to the listed ports.
# Won't touch unrelated processes.

set -u

PORTS=(3000 3001 3002)

for port in "${PORTS[@]}"; do
  pids=$(lsof -t -i ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "→ killing leftover process on :$port (pid: $(echo "$pids" | tr '\n' ' '))"
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
  fi
done

exec vercel dev "$@"
