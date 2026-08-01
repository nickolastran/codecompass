#!/usr/bin/env bash
# Run both services; Ctrl-C kills both.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT INT TERM

(cd backend && . .venv/bin/activate && exec python3 main.py) &
(cd web && exec npm run dev) &

wait
