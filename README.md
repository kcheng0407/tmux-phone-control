# tmux Phone Control

Control and monitor your tmux sessions from **any phone browser** — real-time terminal output, command input, and quick-action keys. Designed for checking on long-running processes (AI agents, training jobs, etc.) while you're away from your desk.

---

## Features

- 📱 **Mobile-first** responsive dark UI
- 🔴 **Real-time streaming** — live pane output via WebSocket (refreshes every 500 ms)
- ⌨️ **Send commands** to any tmux pane
- 🎛️ **Quick-action buttons** — `^C`, `^Z`, `↑`, `↓`, `←`, `→`, `Tab`, `q`, `↵`
- 🔑 **Token authentication** — one secret token protects the interface
- 🎨 **ANSI color support** via [xterm.js](https://xtermjs.org/) — tqdm, rich, htop all render correctly
- 📂 **Session browser** — lists all sessions → windows → panes with one tap to open

---

## Requirements

- Python 3.8+
- `tmux` installed and accessible in `$PATH`
- A running tmux session

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/tmux-phone-control.git
cd tmux-phone-control

# 2. Run the setup script (creates .env on first run)
chmod +x start.sh
./start.sh

# 3. Edit .env and set a secure token
nano .env        # set AUTH_TOKEN=your-secret-here

# 4. Start again
./start.sh
```

The script prints the URL to open on your phone:

```
╔══════════════════════════════════════════════╗
║  🖥   tmux Phone Control                     ║
╠══════════════════════════════════════════════╣
║  Server : http://0.0.0.0:8765                ║
║  Phone  : http://192.168.1.42:8765           ║
╚══════════════════════════════════════════════╝
```

---

## Configuration

Edit `.env` (copied from `.env.example`):

```env
AUTH_TOKEN=your-secret-token-here
PORT=8765
HOST=0.0.0.0
```

| Variable     | Default    | Description                                     |
|--------------|------------|-------------------------------------------------|
| `AUTH_TOKEN` | `changeme` | Secret token shown on the phone's login screen  |
| `PORT`       | `8765`     | Port the web server binds to                    |
| `HOST`       | `0.0.0.0`  | Bind address (`0.0.0.0` = all network interfaces) |

---

## Accessing from Your Phone

1. Connect your phone to the **same VPN** as the lab machine
2. Open a browser on your phone
3. Go to `http://<lab-machine-ip>:<PORT>` (the script prints the exact URL)
4. Enter your `AUTH_TOKEN` when prompted — it's saved in the browser for future visits

---

## Usage

### Dashboard

The main screen lists all tmux **sessions → windows → panes**. Each pane shows:
- The command currently running (e.g., `python`, `bash`, `htop`)
- The tmux target address (e.g., `main:0.0`)
- A green dot on the currently active pane

Tap any pane to open its live terminal view.

### Terminal View

| Element | Description |
|---------|-------------|
| **← button** | Back to dashboard |
| **Green/red dot** (top right) | WebSocket connection status |
| **Terminal area** | Live xterm.js view, scrollable |
| **Quick-key row** | `^C` `^Z` `↑` `↓` `←` `→` `⇥` `q` `↵` |
| **Command input + ▶** | Type a command and tap send (or press Enter) |

> **Tip:** The terminal shows the current visible pane content. Old output scrolls into xterm's history — swipe up to read it.

---

## Manual Start (without `start.sh`)

```bash
pip install -r requirements.txt
export AUTH_TOKEN=your-token PORT=8765 HOST=0.0.0.0
uvicorn backend.main:app --host 0.0.0.0 --port 8765
```

---

## API Reference

The backend exposes a small REST + WebSocket API (all require `Authorization: Bearer <token>`):

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/sessions` | List all sessions / windows / panes |
| `GET`  | `/api/pane/capture?pane_id=<id>&lines=50` | Snapshot pane output |
| `POST` | `/api/send` | Send text or special key to a pane |
| `WS`   | `/ws?pane_id=<id>&token=<token>` | Live pane stream |
| `GET`  | `/api/health` | Health check |

### `POST /api/send` body

```json
{ "pane_id": "%0", "text": "ls -la", "enter": true }
{ "pane_id": "%0", "key": "C-c" }
{ "pane_id": "%0", "key": "Up" }
```

---

## Project Structure

```
tmux-phone-control/
├── backend/
│   ├── main.py            # FastAPI app — REST routes + WebSocket
│   ├── tmux_manager.py    # tmux subprocess wrappers
│   └── auth.py            # Bearer token middleware
├── frontend/
│   ├── index.html         # Mobile session dashboard
│   ├── terminal.html      # xterm.js terminal view
│   ├── style.css          # Mobile-first dark theme
│   └── app.js             # Dashboard + terminal logic
├── .env.example
├── requirements.txt
├── start.sh
└── README.md
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No tmux sessions found" | Start a session: `tmux new -s main` |
| Can't reach from phone | Ensure phone is on the same VPN; check firewall allows the port |
| Token rejected | Double-check `AUTH_TOKEN` in `.env` matches what you type |
| xterm.js loads but no output | Verify the pane ID is valid; try refreshing the dashboard |
| Port already in use | Change `PORT` in `.env` |

---

## License

MIT
