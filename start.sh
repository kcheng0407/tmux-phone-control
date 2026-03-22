#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── .env setup ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  Created .env from .env.example              ║"
    echo "║                                              ║"
    echo "║  ⚠  Please edit .env and set AUTH_TOKEN,    ║"
    echo "║     then run this script again.              ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""
    exit 1
fi

# ── Dependencies ──────────────────────────────────────────────────────────────
echo "📦  Installing Python dependencies..."
pip install -r requirements.txt -q

# ── Load env vars ─────────────────────────────────────────────────────────────
set -o allexport
# shellcheck disable=SC1091
source .env
set +o allexport

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8765}"

# Try to get the LAN IP for the phone access hint
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  🖥   tmux Phone Control                     ║"
echo "╠══════════════════════════════════════════════╣"
printf  "║  Server : http://%-26s║\n" "${HOST}:${PORT}"
printf  "║  Phone  : http://%-26s║\n" "${LOCAL_IP}:${PORT}"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# ── Start ─────────────────────────────────────────────────────────────────────
uvicorn backend.main:app --host "$HOST" --port "$PORT"
