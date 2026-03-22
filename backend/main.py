import asyncio
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .auth import require_auth, verify_ws_token
from . import tmux_manager

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="tmux Phone Control", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ── HTML pages ────────────────────────────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/terminal")
async def terminal():
    return FileResponse(FRONTEND_DIR / "terminal.html")


# ── REST API ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/sessions", dependencies=[Depends(require_auth)])
async def get_sessions():
    return tmux_manager.get_all()


@app.get("/api/pane/capture", dependencies=[Depends(require_auth)])
async def capture_pane(
    pane_id: str = Query(...),
    lines: int = Query(default=50, ge=1, le=500),
):
    content = tmux_manager.capture_pane(pane_id, history_lines=lines)
    return {"content": content}


class SendRequest(BaseModel):
    pane_id: str
    text: str = ""
    enter: bool = False
    key: str = ""  # special key: "C-c", "Up", "Down", "Enter", etc.


@app.post("/api/send", dependencies=[Depends(require_auth)])
async def send_to_pane(req: SendRequest):
    try:
        if req.key:
            tmux_manager.send_key(req.pane_id, req.key)
        elif req.text:
            tmux_manager.send_text(req.pane_id, req.text, enter=req.enter)
        elif req.enter:
            tmux_manager.send_key(req.pane_id, "Enter")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def ws_stream(
    websocket: WebSocket,
    pane_id: str = Query(...),
    token: str = Query(...),
):
    if not verify_ws_token(token):
        await websocket.close(code=1008, reason="Invalid token")
        return

    await websocket.accept()
    logger.info("WebSocket connected for pane %s", pane_id)
    last_content = ""

    try:
        # Send initial content with scrollback history
        content = tmux_manager.capture_pane(pane_id, history_lines=100)
        if content:
            await websocket.send_json({"type": "init", "content": content})
            last_content = content

        while True:
            await asyncio.sleep(0.5)
            content = tmux_manager.capture_pane(pane_id)
            if content != last_content:
                await websocket.send_json({"type": "refresh", "content": content})
                last_content = content

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for pane %s", pane_id)
    except Exception as e:
        logger.error("WebSocket error for pane %s: %s", pane_id, e)
