// ── Shared Utilities ──────────────────────────────────────────────────────────

const TOKEN_KEY = 'tmux_ctrl_token';

function getToken()        { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t)       { localStorage.setItem(TOKEN_KEY, t); }
function clearToken()      { localStorage.removeItem(TOKEN_KEY); }

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
            ...(options.headers || {}),
        },
    });
    if (res.status === 401) {
        clearToken();
        location.replace('/');
        throw new Error('Unauthorized');
    }
    return res;
}


// ── Dashboard ─────────────────────────────────────────────────────────────────

function initDashboard() {
    const loginScreen = document.getElementById('login-screen');
    const dashboard   = document.getElementById('dashboard');
    const tokenInput  = document.getElementById('token-input');
    const loginBtn    = document.getElementById('login-btn');
    const loginError  = document.getElementById('login-error');
    const refreshBtn  = document.getElementById('refresh-btn');

    function showError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
    }

    async function tryLogin(token) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Connecting…';
        try {
            const res = await fetch('/api/sessions', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.status === 401) {
                clearToken();
                showError('Invalid token. Please try again.');
                return;
            }
            // Token works — store and show dashboard
            setToken(token);
            loginScreen.classList.add('hidden');
            showDashboard();
        } catch {
            showError('Cannot reach server. Is it running?');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Connect';
        }
    }

    loginBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (!token) return;
        tryLogin(token);
    });

    tokenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    refreshBtn && refreshBtn.addEventListener('click', loadSessions);

    function showDashboard() {
        dashboard.classList.remove('hidden');
        loadSessions();
    }

    if (getToken()) {
        showDashboard();
    } else {
        loginScreen.classList.remove('hidden');
        setTimeout(() => tokenInput.focus(), 100);
    }

    // ── Session rendering ──────────────────────────────────────────────────

    async function loadSessions() {
        const container = document.getElementById('sessions-container');
        container.innerHTML = '<div class="loading">Loading sessions…</div>';
        try {
            const res = await apiFetch('/api/sessions');
            const sessions = await res.json();
            renderSessions(sessions, container);
        } catch (e) {
            if (e.message !== 'Unauthorized') {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <p>Failed to load sessions</p>
                        <p style="margin-top:8px;font-size:13px;color:var(--text2)">
                            Check that the server is running
                        </p>
                    </div>`;
            }
        }
    }

    function renderSessions(sessions, container) {
        if (!sessions.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No tmux sessions found</p>
                    <p style="margin-top:8px;font-size:13px;color:var(--text2)">
                        Start a session with <code>tmux new -s main</code>
                    </p>
                </div>`;
            return;
        }

        container.innerHTML = sessions.map(session => `
            <div class="session-card">
                <div class="session-header">
                    <span class="session-name">📁 ${escHtml(session.name)}</span>
                    <span class="session-id">${escHtml(session.id)}</span>
                </div>
                ${session.windows.map(win => `
                    <div class="window-section">
                        <div class="window-label">
                            Window ${escHtml(win.index)}: ${escHtml(win.name)}
                            ${win.active ? '· <span style="color:var(--success)">active</span>' : ''}
                        </div>
                        ${win.panes.map(pane => `
                            <button class="pane-btn ${pane.active ? 'active-pane' : ''}"
                                    data-pane-id="${escHtml(pane.id)}"
                                    data-label="${escHtml(pane.display)}">
                                <span class="pane-icon">${pane.active ? '▶' : '⬜'}</span>
                                <div class="pane-details">
                                    <div class="pane-cmd">${escHtml(pane.current_command)}</div>
                                    <div class="pane-target">${escHtml(pane.target)}</div>
                                </div>
                                ${pane.active ? '<div class="active-dot"></div>' : ''}
                                <span class="pane-chevron">›</span>
                            </button>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `).join('');

        // Event delegation — one listener for all pane buttons
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.pane-btn');
            if (!btn) return;
            const paneId = btn.dataset.paneId;
            const label  = btn.dataset.label;
            const params = new URLSearchParams({ pane: paneId, label });
            location.href = `/terminal?${params}`;
        }, { once: true });
    }
}


// ── Terminal ──────────────────────────────────────────────────────────────────

function initTerminal() {
    const params = new URLSearchParams(location.search);
    const paneId = params.get('pane');
    const label  = params.get('label') || paneId;

    if (!paneId || !getToken()) {
        location.replace('/');
        return;
    }

    document.getElementById('pane-label').textContent = label;
    document.getElementById('back-btn').addEventListener('click', () => {
        location.href = '/';
    });

    // ── xterm.js setup ─────────────────────────────────────────────────────
    const term = new Terminal({
        theme: {
            background:         '#000000',
            foreground:         '#e8e8f0',
            cursor:             '#4f8ef7',
            cursorAccent:       '#000000',
            selectionBackground: 'rgba(79,142,247,0.25)',
            black:   '#1a1a2e', red:     '#e05c5c', green:   '#4caf84', yellow:  '#f0c040',
            blue:    '#4f8ef7', magenta: '#c07af0', cyan:    '#4fc4cf', white:   '#e8e8f0',
            brightBlack:   '#505070', brightRed:     '#ff7070', brightGreen:   '#64e09a',
            brightYellow:  '#ffd060', brightBlue:    '#70a8ff', brightMagenta: '#d090ff',
            brightCyan:    '#60d8e8', brightWhite:   '#ffffff',
        },
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        convertEol: true,
        scrollback: 3000,
        cursorStyle: 'block',
        cursorBlink: false,
        disableStdin: true,  // we manage input manually
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal-container'));
    fitAddon.fit();

    window.addEventListener('resize', () => fitAddon.fit());

    // ── WebSocket ───────────────────────────────────────────────────────────
    const wsIndicator = document.getElementById('ws-status');
    let ws = null;
    let reconnectTimer = null;

    function connect() {
        if (ws && ws.readyState <= 1) return; // already open/connecting
        clearTimeout(reconnectTimer);

        const proto  = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl  = `${proto}//${location.host}/ws`
                     + `?pane_id=${encodeURIComponent(paneId)}`
                     + `&token=${encodeURIComponent(getToken())}`;

        wsIndicator.className = 'ws-indicator connecting';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            wsIndicator.className = 'ws-indicator connected';
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleTerminalMessage(term, msg, fitAddon);
            } catch { /* ignore parse errors */ }
        };

        ws.onclose = (e) => {
            wsIndicator.className = 'ws-indicator disconnected';
            if (e.code !== 1008) {
                // Reconnect after 3s unless kicked for bad token
                reconnectTimer = setTimeout(connect, 3000);
            }
        };

        ws.onerror = () => {
            wsIndicator.className = 'ws-indicator disconnected';
        };
    }

    connect();

    // ── Send input ──────────────────────────────────────────────────────────
    const cmdInput = document.getElementById('cmd-input');
    const sendBtn  = document.getElementById('send-btn');

    async function sendText(text, enter = true) {
        try {
            await apiFetch('/api/send', {
                method: 'POST',
                body: JSON.stringify({ pane_id: paneId, text, enter }),
            });
        } catch (e) {
            if (e.message !== 'Unauthorized') console.error('Send error:', e);
        }
    }

    async function sendKey(key) {
        try {
            await apiFetch('/api/send', {
                method: 'POST',
                body: JSON.stringify({ pane_id: paneId, key }),
            });
        } catch (e) {
            if (e.message !== 'Unauthorized') console.error('Send key error:', e);
        }
    }

    function submitInput() {
        const text = cmdInput.value;
        if (!text) return;
        sendText(text, true);
        cmdInput.value = '';
    }

    sendBtn.addEventListener('click', submitInput);

    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { submitInput(); e.preventDefault(); }
    });

    document.querySelectorAll('.qkey').forEach(btn => {
        btn.addEventListener('click', () => sendKey(btn.dataset.key));
    });
}


function handleTerminalMessage(term, msg, fitAddon) {
    if (msg.type === 'init') {
        term.write(msg.content);
        term.scrollToBottom();
        // Fit after initial content is written
        setTimeout(() => fitAddon && fitAddon.fit(), 50);
    } else if (msg.type === 'refresh') {
        // Erase display and rewrite — old content stays in scrollback
        term.write('\x1b[2J\x1b[H' + msg.content);
        term.scrollToBottom();
    }
}
