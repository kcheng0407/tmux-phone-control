import subprocess
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


def _run(*args: str, timeout: int = 5) -> str:
    try:
        result = subprocess.run(
            ["tmux"] + list(args),
            capture_output=True, text=True, timeout=timeout,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.warning("tmux command timed out: %s", args)
        return ""
    except Exception as e:
        logger.error("tmux command error: %s", e)
        return ""


def get_all() -> List[Dict]:
    """Return all sessions → windows → panes as a nested structure."""
    sessions: List[Dict] = []

    sess_out = _run("list-sessions", "-F", "#{session_id}|#{session_name}")
    if not sess_out:
        return sessions

    for sess_line in sess_out.splitlines():
        parts = sess_line.split("|", 1)
        if len(parts) != 2:
            continue
        sess_id, sess_name = parts
        session: Dict = {"id": sess_id, "name": sess_name, "windows": []}

        win_out = _run(
            "list-windows", "-t", sess_name, "-F",
            "#{window_id}|#{window_index}|#{window_name}|#{window_active}",
        )
        for win_line in win_out.splitlines():
            wparts = win_line.split("|", 3)
            if len(wparts) != 4:
                continue
            win_id, win_idx, win_name, win_active = wparts
            window: Dict = {
                "id": win_id, "index": win_idx, "name": win_name,
                "active": win_active == "1", "panes": [],
            }

            pane_out = _run(
                "list-panes", "-t", f"{sess_name}:{win_idx}", "-F",
                "#{pane_id}|#{pane_index}|#{pane_active}|#{pane_current_command}",
            )
            for pane_line in pane_out.splitlines():
                pparts = pane_line.split("|", 3)
                if len(pparts) != 4:
                    continue
                pane_id, pane_idx, pane_active, pane_cmd = pparts
                window["panes"].append({
                    "id": pane_id,
                    "index": pane_idx,
                    "active": pane_active == "1",
                    "current_command": pane_cmd,
                    "target": f"{sess_name}:{win_idx}.{pane_idx}",
                    "display": f"{sess_name}:{win_idx}.{pane_idx}  [{pane_cmd}]",
                })

            session["windows"].append(window)
        sessions.append(session)

    return sessions


def capture_pane(pane_id: str, history_lines: int = 0) -> str:
    """Capture pane content with ANSI escape codes preserved."""
    args = ["capture-pane", "-p", "-e", "-t", pane_id]
    if history_lines > 0:
        args.extend(["-S", f"-{history_lines}"])
    try:
        result = subprocess.run(
            ["tmux"] + args, capture_output=True, text=True, timeout=5,
        )
        return result.stdout
    except Exception as e:
        logger.error("capture_pane error for %s: %s", pane_id, e)
        return f"Error capturing pane: {e}\n"


def send_text(pane_id: str, text: str, enter: bool = False) -> None:
    """Send literal text to a pane. Uses -l flag to disable key-name interpretation."""
    _run("send-keys", "-l", "-t", pane_id, text)
    if enter:
        _run("send-keys", "-t", pane_id, "Enter")


def send_key(pane_id: str, key: str) -> None:
    """Send a special key (e.g. 'C-c', 'Up', 'Down', 'Enter', 'q') to a pane."""
    _run("send-keys", "-t", pane_id, key)


def get_pane_info(pane_id: str) -> Optional[Dict]:
    all_sessions = get_all()
    for sess in all_sessions:
        for win in sess["windows"]:
            for pane in win["panes"]:
                if pane["id"] == pane_id:
                    return {
                        **pane,
                        "session_name": sess["name"],
                        "window_name": win["name"],
                    }
    return None
