"""HTTP service for teacher class-agent chat."""

from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from class_agent.agent import run_agent_turn
from config import CLASS_AGENT_TIMEOUT_MS, GOOGLE_API_KEY, MONGO_URI


class AgentChatRequest(BaseModel):
    userId: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=4000)
    conversationId: str | None = None


class AgentChatMeta(BaseModel):
    fallbackUsed: bool = False
    durationMs: int


class AgentChatResponse(BaseModel):
    reply: str
    sessionId: str
    meta: AgentChatMeta


app = FastAPI(title="SCMS Class Agent Service", version="1.0.0")


def _mongo_health() -> tuple[bool, str]:
    if not MONGO_URI:
        return False, "MONGO_URI/MONGODB_URI is not configured"

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        client.close()
        return True, "ok"
    except PyMongoError as exc:
        return False, f"MongoDB unavailable: {exc.__class__.__name__}"


@app.get("/health")
async def health():
    mongo_ok, mongo_msg = _mongo_health()
    return {
        "status": "online" if mongo_ok else "degraded",
        "google_api_key_configured": bool(GOOGLE_API_KEY),
        "mongo": {"ok": mongo_ok, "message": mongo_msg},
        "timeout_ms": CLASS_AGENT_TIMEOUT_MS,
    }


@app.post("/agent/chat", response_model=AgentChatResponse)
async def chat(req: AgentChatRequest):
    session_id = req.conversationId or f"teacher-{uuid.uuid4()}"
    start = time.time()

    try:
        reply = await run_agent_turn(
            user_id=req.userId,
            session_id=session_id,
            message=req.message.strip(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Class agent request failed: {exc.__class__.__name__}",
        ) from exc

    duration_ms = int((time.time() - start) * 1000)
    return AgentChatResponse(
        reply=reply,
        sessionId=session_id,
        meta=AgentChatMeta(durationMs=duration_ms),
    )


if __name__ == "__main__":
    import uvicorn

    from config import CLASS_AGENT_HOST, CLASS_AGENT_PORT

    uvicorn.run(
        "agent_service:app",
        host=CLASS_AGENT_HOST,
        port=CLASS_AGENT_PORT,
        reload=True,
    )
