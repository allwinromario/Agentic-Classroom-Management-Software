"""
SCMS Face Recognition Attendance Service — v3
FastAPI microservice with face_recognition (dlib) → mock fallback.

Key improvements over v2:
- Embeddings persisted to a JSON file (embeddings.json) alongside the DB,
  so they survive service restarts reliably regardless of DB query issues.
- Multi-sample averaging: up to 3 stored embeddings per student, verification
  uses the best (lowest distance) match against all stored samples.
- Relaxed dlib threshold (0.6) for better real-world reliability.
- Startup always loads from JSON file first, then syncs from DB as fallback.

Endpoints:
  GET  /health
  POST /register-face       { studentId, imageBase64 }
  POST /verify-face         { studentId, imageBase64, antiSpoofing? }
  POST /mark-attendance     { frame, classId }
  POST /reload-embeddings
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import sqlite3
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format="%(asctime)s  %(levelname)-8s  %(message)s")
log = logging.getLogger("scms.face")

# ---------------------------------------------------------------------------
# Optional imports — two-tier fallback
# ---------------------------------------------------------------------------
FACE_MODE = "mock"

try:
    import cv2
    import face_recognition
    from PIL import Image
    FACE_MODE = "face_recognition"
    log.info("✅ face_recognition + OpenCV loaded")
except ImportError as _e:
    log.warning(f"⚠️  face_recognition not available ({_e}). Running in mock mode.")

try:
    from deepface import DeepFace
    _test = np.zeros((48, 48, 3), dtype=np.uint8)
    FACE_MODE = "deepface"
    log.info("✅ DeepFace loaded — using ArcFace model")
except Exception as _e1:
    if FACE_MODE != "face_recognition":
        log.warning(f"⚠️  DeepFace not available ({_e1}).")

# ---------------------------------------------------------------------------
# Thresholds
# Dlib 128-D euclidean: 0.6 is reliable for varied lighting/angles.
# ArcFace cosine: 0.68 recommended.
# ---------------------------------------------------------------------------
DLIB_THRESHOLD   = 0.6    # raised from 0.55 — less false-negatives
ARCFACE_THRESHOLD = 0.68

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_here    = Path(__file__).parent
_web_dir = _here.parent / "web"

_db_url  = os.getenv("SCMS_DB_URL", f"file:{_web_dir / 'prisma' / 'dev.db'}")
DB_PATH  = Path(_db_url.replace("file:", "").strip())

# Persistent JSON file — source of truth for embeddings across restarts
EMBEDDINGS_FILE = _here / "embeddings.json"

log.info(f"SQLite path:      {DB_PATH} (exists={DB_PATH.exists()})")
log.info(f"Embeddings file:  {EMBEDDINGS_FILE}")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# In-memory cache
# Structure: { student_id: { "samples": [[...emb...], ...], "mode": str } }
# Multiple samples per student for robust matching.
# ---------------------------------------------------------------------------
_embedding_cache: dict[str, dict] = {}


def _save_to_file() -> None:
    """Persist the current in-memory cache to embeddings.json."""
    try:
        with open(EMBEDDINGS_FILE, "w") as f:
            json.dump(_embedding_cache, f)
        log.info(f"Saved {len(_embedding_cache)} embeddings to {EMBEDDINGS_FILE}")
    except Exception as e:
        log.error(f"Failed to save embeddings file: {e}")


def _load_from_file() -> int:
    """Load embeddings from the JSON file. Returns count loaded."""
    global _embedding_cache
    if not EMBEDDINGS_FILE.exists():
        log.info("No embeddings.json found — starting fresh.")
        return 0
    try:
        with open(EMBEDDINGS_FILE, "r") as f:
            data = json.load(f)
        _embedding_cache = data
        log.info(f"Loaded {len(_embedding_cache)} embeddings from {EMBEDDINGS_FILE}")
        return len(_embedding_cache)
    except Exception as e:
        log.error(f"Failed to load embeddings file: {e}")
        return 0


def _load_from_db() -> int:
    """Sync embeddings from SQLite DB (fallback / merge). Returns count loaded."""
    if not DB_PATH.exists():
        log.warning("DB not found — skipping DB sync.")
        return 0
    try:
        conn = get_conn()
        rows = conn.execute(
            "SELECT id, faceEmbedding FROM users WHERE faceEmbedding IS NOT NULL"
        ).fetchall()
        conn.close()
    except Exception as exc:
        log.error(f"DB sync failed: {exc}")
        return 0

    loaded = 0
    for row in rows:
        sid = row["id"]
        # Skip if already in cache from file (file is authoritative)
        if sid in _embedding_cache:
            continue
        raw = row["faceEmbedding"]
        if not raw:
            continue
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                # Legacy flat array — wrap into new format
                _embedding_cache[sid] = {"samples": [data], "mode": "legacy"}
                loaded += 1
            elif isinstance(data, dict):
                if "samples" in data:
                    _embedding_cache[sid] = data
                    loaded += 1
                elif "embedding" in data:
                    _embedding_cache[sid] = {
                        "samples": [data["embedding"]],
                        "mode": data.get("mode", "face_recognition"),
                    }
                    loaded += 1
        except json.JSONDecodeError:
            pass

    if loaded:
        log.info(f"Merged {loaded} additional embeddings from DB")
        _save_to_file()   # persist newly merged entries
    return loaded


def _load_embeddings() -> None:
    n = _load_from_file()
    n += _load_from_db()
    log.info(f"Total embeddings in cache: {len(_embedding_cache)}")


def _persist_embedding(student_id: str, embedding: list[float], face_mode: str) -> None:
    """
    Add a new sample for the student (up to MAX_SAMPLES).
    Saves to JSON file AND SQLite DB.
    """
    MAX_SAMPLES = 3
    existing = _embedding_cache.get(student_id, {"samples": [], "mode": face_mode})
    samples: list = existing.get("samples", [])

    # Append new sample; keep only the last MAX_SAMPLES
    samples.append(embedding)
    if len(samples) > MAX_SAMPLES:
        samples = samples[-MAX_SAMPLES:]

    _embedding_cache[student_id] = {"samples": samples, "mode": face_mode}
    _save_to_file()

    # Write representative sample (average) to SQLite for backup
    try:
        avg_emb = np.mean([np.array(s) for s in samples], axis=0).tolist()
        payload = json.dumps({"samples": samples, "mode": face_mode,
                              "embedding": avg_emb})  # keep "embedding" for legacy reads
        conn = get_conn()
        conn.execute(
            "UPDATE users SET faceEmbedding=?, faceRegistered=1, "
            "faceRetakeApproved=0, faceRetakeRequested=0 WHERE id=?",
            (payload, student_id)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        log.error(f"DB write failed for {student_id}: {e}")

    log.info(f"Registered face for {student_id} via {face_mode} "
             f"({len(samples)} sample(s))")


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_embeddings()
    yield
    log.info("Shutting down…")


app = FastAPI(title="SCMS Face Recognition Service v3", version="3.0.0",
              lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        for ws in list(self.active):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RegisterFaceRequest(BaseModel):
    studentId: str
    imageBase64: str

class VerifyFaceRequest(BaseModel):
    studentId: str
    imageBase64: str
    antiSpoofing: bool = False

class MarkAttendanceRequest(BaseModel):
    frame: str
    classId: str
    tolerance: float = 0.6

class AttendanceResponse(BaseModel):
    detected_students: list[str]
    face_count: int
    message: str


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------
def _decode_image_array(b64_data: str) -> Optional[np.ndarray]:
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64_data)
    except Exception as e:
        log.error(f"Base64 decode error: {e}")
        return None

    try:
        from PIL import Image as PILImage
        img = PILImage.open(io.BytesIO(raw)).convert("RGB")
        return np.array(img)
    except Exception as e:
        log.error(f"Image decode error: {e}")
        return None


# ---------------------------------------------------------------------------
# Embedding extraction
# ---------------------------------------------------------------------------
def _get_embedding(image_array: np.ndarray) -> Optional[list[float]]:
    if FACE_MODE == "deepface":
        for backend in ("retinaface", "opencv", "mtcnn"):
            try:
                result = DeepFace.represent(
                    img_path=image_array,
                    model_name="ArcFace",
                    detector_backend=backend,
                    enforce_detection=True,
                    align=True,
                )
                return result[0]["embedding"]
            except Exception as e:
                log.warning(f"ArcFace/{backend} failed: {e}")
        log.error("All DeepFace backends failed")
        return None

    elif FACE_MODE == "face_recognition":
        try:
            # Try HOG first (fast), fall back to CNN (more accurate)
            encs = face_recognition.face_encodings(
                image_array,
                face_recognition.face_locations(image_array, model="hog")
            )
            if not encs:
                # CNN model — slower but handles varied angles/lighting better
                encs = face_recognition.face_encodings(
                    image_array,
                    face_recognition.face_locations(image_array, model="cnn")
                ) if hasattr(face_recognition, "face_locations") else []
            if encs:
                return encs[0].tolist()
            log.warning("No face detected in image")
            return None
        except Exception as e:
            log.error(f"face_recognition encoding failed: {e}")
            return None

    return None  # mock mode — handled separately


# ---------------------------------------------------------------------------
# Face comparison — best-of-samples matching
# ---------------------------------------------------------------------------
def _best_distance(stored: dict, live_enc: list[float]) -> tuple[bool, float]:
    """
    Compare live embedding against all stored samples.
    Returns (verified, best_distance) — best = lowest distance.
    """
    mode = stored.get("mode", "face_recognition")
    samples: list = stored.get("samples", [])

    # Legacy support: flat list stored directly
    if not samples and "embedding" in stored:
        samples = [stored["embedding"]]

    if not samples:
        return False, 1.0

    live = np.array(live_enc, dtype=np.float64)
    best = 1.0

    for sample in samples:
        stored_enc = np.array(sample, dtype=np.float64)

        if mode == "deepface" or len(sample) > 200:
            # ArcFace — cosine distance
            norm_s = np.linalg.norm(stored_enc)
            norm_l = np.linalg.norm(live)
            if norm_s == 0 or norm_l == 0:
                continue
            cosine_sim = np.dot(stored_enc, live) / (norm_s * norm_l)
            dist = float(1.0 - cosine_sim)
        else:
            # dlib 128-D — euclidean distance
            dist = float(np.linalg.norm(stored_enc - live))

        best = min(best, dist)

    threshold = ARCFACE_THRESHOLD if (mode == "deepface" or len(samples[0]) > 200) \
                else DLIB_THRESHOLD
    return best < threshold, best


# ===========================================================================
# Routes
# ===========================================================================

@app.get("/health")
async def health():
    return {
        "status": "online",
        "face_mode": FACE_MODE,
        "students_cached": len(_embedding_cache),
        "db_exists": DB_PATH.exists(),
        "embeddings_file_exists": EMBEDDINGS_FILE.exists(),
        "thresholds": {
            "dlib_euclidean": DLIB_THRESHOLD,
            "arcface_cosine": ARCFACE_THRESHOLD,
        }
    }


@app.post("/register-face")
async def register_face(req: RegisterFaceRequest):
    if FACE_MODE == "mock":
        mock_enc = list(np.random.rand(128).tolist())
        _persist_embedding(req.studentId, mock_enc, "mock")
        return {"success": True, "mode": "mock", "studentId": req.studentId,
                "message": "Mock embedding stored (AI libs not installed)"}

    img = _decode_image_array(req.imageBase64)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    enc = _get_embedding(img)
    if enc is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected. Please ensure your face is clearly visible, "
                   "well-lit, and facing the camera directly."
        )

    _persist_embedding(req.studentId, enc, FACE_MODE)
    samples_count = len(_embedding_cache.get(req.studentId, {}).get("samples", []))
    return {
        "success": True,
        "mode": FACE_MODE,
        "studentId": req.studentId,
        "dimensions": len(enc),
        "samples_stored": samples_count,
        "message": f"Face registered successfully ({samples_count} sample(s) stored)",
    }


@app.post("/verify-face")
async def verify_face(req: VerifyFaceRequest):
    cached = _embedding_cache.get(req.studentId)
    if not cached:
        # Try reloading before giving up
        _load_embeddings()
        cached = _embedding_cache.get(req.studentId)
        if not cached:
            raise HTTPException(
                status_code=404,
                detail="No face registered for this student. "
                       "Please register your face first."
            )

    if FACE_MODE == "mock":
        return {"verified": True, "confidence": 0.95, "distance": 0.05,
                "mode": "mock", "message": "Verified (mock mode)"}

    img = _decode_image_array(req.imageBase64)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    # Anti-spoofing (DeepFace only — non-critical)
    if FACE_MODE == "deepface" and req.antiSpoofing:
        try:
            result = DeepFace.extract_faces(
                img_path=img,
                detector_backend="opencv",
                anti_spoofing=True,
            )
            if result and result[0].get("is_real") is False:
                raise HTTPException(
                    status_code=403,
                    detail="Liveness check failed — please do not use a photo or video."
                )
        except HTTPException:
            raise
        except Exception:
            pass  # non-critical

    live_enc = _get_embedding(img)
    if live_enc is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected. Please ensure good lighting, face the camera "
                   "directly, and remove any obstructions (mask, glasses if possible)."
        )

    verified, distance = _best_distance(cached, live_enc)
    confidence = round(max(0.0, 1.0 - distance), 4)

    log.info(f"verify-face: student={req.studentId} verified={verified} "
             f"dist={distance:.4f} samples={len(cached.get('samples', []))}")

    if verified:
        msg = f"Identity confirmed (confidence {confidence*100:.1f}%)"
    elif distance < (DLIB_THRESHOLD + 0.1):
        msg = ("Face partially matches — try better lighting or a different angle. "
               "If this keeps failing, re-register your face.")
    else:
        msg = ("Face does not match the registered photo. "
               "Ensure you are the registered student and have good lighting.")

    return {
        "verified": verified,
        "confidence": confidence,
        "distance": round(distance, 4),
        "mode": FACE_MODE,
        "message": msg,
    }


@app.post("/mark-attendance", response_model=AttendanceResponse)
async def mark_attendance(req: MarkAttendanceRequest):
    if FACE_MODE == "mock":
        detected = list(_embedding_cache.keys())[:2]
        await manager.broadcast({
            "event": "attendance_update",
            "classId": req.classId,
            "detected": detected,
            "mode": "mock",
        })
        return AttendanceResponse(
            detected_students=detected,
            face_count=len(detected),
            message=f"Mock mode — detected {len(detected)} student(s)"
        )

    img = _decode_image_array(req.frame)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode frame")

    if FACE_MODE == "deepface":
        try:
            result = DeepFace.represent(
                img_path=img,
                model_name="ArcFace",
                detector_backend="opencv",
                enforce_detection=False,
                align=True,
            )
            face_encodings = [r["embedding"] for r in result]
        except Exception as e:
            log.warning(f"DeepFace mark-attendance failed: {e}")
            return AttendanceResponse(detected_students=[], face_count=0,
                                      message="No faces detected in frame")
    else:
        locs = face_recognition.face_locations(img, model="hog")
        face_encodings = [e.tolist() for e in face_recognition.face_encodings(img, locs)]

    detected_ids: set[str] = set()
    for enc in face_encodings:
        for sid, cached in _embedding_cache.items():
            verified, _ = _best_distance(cached, enc)
            if verified:
                detected_ids.add(sid)

    result_list = list(detected_ids)
    log.info(f"mark-attendance: {len(face_encodings)} faces, "
             f"{len(result_list)} matches for class {req.classId}")

    await manager.broadcast({
        "event": "attendance_update",
        "classId": req.classId,
        "detected": result_list,
        "face_count": len(face_encodings),
    })

    return AttendanceResponse(
        detected_students=result_list,
        face_count=len(face_encodings),
        message=f"Detected {len(face_encodings)} face(s), matched {len(result_list)}"
    )


@app.post("/reload-embeddings")
async def reload_embeddings():
    _embedding_cache.clear()
    _load_embeddings()
    return {"success": True, "count": len(_embedding_cache)}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("attendance_service:app", host="0.0.0.0", port=8000, reload=True)
