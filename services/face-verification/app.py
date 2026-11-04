from __future__ import annotations

import base64
import json
import os
import socket
import sqlite3
import struct
from contextlib import closing
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
DATA_DIR = Path(os.getenv(
    "FACE_DATA_DIR",
    str(Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "civic-ledger-face"),
))
DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
try:
    DATA_DIR.chmod(0o700)
except OSError:
    pass
DB_PATH = Path(os.getenv("FACE_DB_PATH", str(DATA_DIR / "face_templates.sqlite3")))
DEPTH_SOCKET = os.getenv("OAK_DEPTH_SOCKET", "/tmp/oak_depth.sock")
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.363"))
MAX_IMAGE_BYTES = 8 * 1024 * 1024
DEPTH_TIMEOUT_SECONDS = float(os.getenv("OAK_DEPTH_TIMEOUT", "1.5"))

DETECTOR_MODEL = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
RECOGNIZER_MODEL = MODEL_DIR / "face_recognition_sface_2021dec.onnx"

app = FastAPI(title="Civic Ledger Local Face Verification", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

_detector = None
_recognizer = None


class ImageRequest(BaseModel):
    image: str = Field(min_length=32)
    camera_source: Literal["webcam", "oak"] = "webcam"


class EnrollRequest(ImageRequest):
    replace_existing: bool = False


class VerifyRequest(ImageRequest):
    check_depth: bool = False


def init_db() -> None:
    with closing(sqlite3.connect(DB_PATH)) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS face_template (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                embedding BLOB NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        connection.commit()
    try:
        DB_PATH.chmod(0o600)
    except OSError:
        pass


def models():
    global _detector, _recognizer
    if not DETECTOR_MODEL.exists() or not RECOGNIZER_MODEL.exists():
        raise HTTPException(
            status_code=503,
            detail="Face models are missing. Run: python download_models.py",
        )
    if _detector is None:
        _detector = cv2.FaceDetectorYN.create(
            str(DETECTOR_MODEL), "", (320, 320), 0.85, 0.3, 5000
        )
    if _recognizer is None:
        _recognizer = cv2.FaceRecognizerSF.create(str(RECOGNIZER_MODEL), "")
    return _detector, _recognizer


def decode_image(encoded: str) -> np.ndarray:
    raw = encoded.split(",", 1)[1] if encoded.startswith("data:") and "," in encoded else encoded
    try:
        payload = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Image must be valid base64.") from exc
    if not payload or len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is empty or exceeds the 8 MB limit.")
    image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode the camera image.")
    return image


def extract_face(image: np.ndarray):
    detector, recognizer = models()
    height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        raise HTTPException(status_code=422, detail="No face detected. Centre your face and try again.")
    if len(faces) > 1:
        raise HTTPException(status_code=422, detail="More than one face detected. Only one person may be in frame.")
    face = faces[0]
    aligned = recognizer.alignCrop(image, face)
    feature = recognizer.feature(aligned).astype(np.float32).reshape(-1)
    norm = float(np.linalg.norm(feature))
    if norm == 0:
        raise HTTPException(status_code=422, detail="Could not extract a usable face template.")
    feature /= norm
    x, y, w, h = [int(round(value)) for value in face[:4]]
    return feature, (max(0, x), max(0, y), min(width, x + w), min(height, y + h))


def read_exact(connection: socket.socket, length: int) -> bytes:
    chunks = bytearray()
    while len(chunks) < length:
        part = connection.recv(length - len(chunks))
        if not part:
            raise RuntimeError("OAK depth bridge closed the socket before sending a full frame.")
        chunks.extend(part)
    return bytes(chunks)


def oak_depth_frame() -> np.ndarray:
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(DEPTH_TIMEOUT_SECONDS)
    try:
        client.connect(DEPTH_SOCKET)
        # The bridge streams one frame immediately after a client connects.
        header = read_exact(client, 12)
        width, height, payload_bytes = struct.unpack("<III", header)
        expected = width * height * 2
        if width <= 0 or height <= 0 or width > 4096 or height > 4096 or payload_bytes != expected:
            raise RuntimeError("OAK depth bridge returned an invalid frame header.")
        payload = read_exact(client, payload_bytes)
        return np.frombuffer(payload, dtype="<u2").reshape((height, width)).copy()
    except (OSError, RuntimeError, socket.timeout) as exc:
        raise RuntimeError(f"Could not read OAK depth frame from {DEPTH_SOCKET}: {exc}") from exc
    finally:
        client.close()


def evaluate_depth(depth: np.ndarray, box: tuple[int, int, int, int], rgb_size: tuple[int, int]):
    rgb_width, rgb_height = rgb_size
    x1, y1, x2, y2 = box
    scale_x, scale_y = depth.shape[1] / rgb_width, depth.shape[0] / rgb_height
    dx1, dx2 = max(0, int(x1 * scale_x)), min(depth.shape[1], int(x2 * scale_x))
    dy1, dy2 = max(0, int(y1 * scale_y)), min(depth.shape[0], int(y2 * scale_y))
    roi = depth[dy1:dy2, dx1:dx2]
    if roi.size == 0:
        return {"passed": False, "reason": "Face region did not overlap the depth frame."}

    height, width = roi.shape
    inner = roi[int(height * 0.16):int(height * 0.90), int(width * 0.16):int(width * 0.84)]
    valid = inner[(inner >= 200) & (inner <= 2500)].astype(np.float32)
    valid_ratio = float(valid.size / max(inner.size, 1))
    if valid.size < 80 or valid_ratio < 0.35:
        return {
            "passed": False,
            "reason": "Insufficient valid stereo depth over the face.",
            "valid_ratio": round(valid_ratio, 3),
        }

    p10, median, p90 = [float(value) for value in np.percentile(valid, [10, 50, 90])]
    spread = p90 - p10

    # A real face should have a nearer nose bridge than the left/right cheeks.
    # This assumes the bridge depth map is aligned to its RGB camera.
    nose = roi[int(height * 0.34):int(height * 0.72), int(width * 0.40):int(width * 0.60)]
    left_cheek = roi[int(height * 0.40):int(height * 0.74), int(width * 0.17):int(width * 0.38)]
    right_cheek = roi[int(height * 0.40):int(height * 0.74), int(width * 0.62):int(width * 0.83)]

    def region_median(region: np.ndarray) -> float | None:
        values = region[(region >= 200) & (region <= 2500)]
        return float(np.median(values)) if values.size >= 12 else None

    nose_depth = region_median(nose)
    cheek_depths = [
        value for value in (region_median(left_cheek), region_median(right_cheek))
        if value is not None
    ]
    nose_relief = (
        float(np.median(cheek_depths)) - nose_depth
        if nose_depth is not None and cheek_depths
        else None
    )

    passed = spread >= 15.0 and nose_relief is not None and nose_relief >= 5.0
    reason = (
        "Stereo depth shows facial surface variation and a nearer nose region."
        if passed
        else "The depth map does not show enough 3D facial shape. Check alignment, distance and lighting."
    )
    return {
        "passed": bool(passed),
        "reason": reason,
        "valid_ratio": round(valid_ratio, 3),
        "median_depth_mm": round(median, 1),
        "depth_spread_mm": round(spread, 1),
        "nose_relief_mm": round(nose_relief, 1) if nose_relief is not None else None,
    }


def template_status() -> bool:
    with closing(sqlite3.connect(DB_PATH)) as connection:
        return connection.execute("SELECT 1 FROM face_template WHERE id = 1").fetchone() is not None


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {
        "ok": True,
        "models_available": DETECTOR_MODEL.exists() and RECOGNIZER_MODEL.exists(),
        "face_registered": template_status(),
        "oak_depth_socket": DEPTH_SOCKET,
        "oak_depth_available": Path(DEPTH_SOCKET).exists(),
        "oak_depth_protocol": "12-byte little-endian <III header + uint16 millimetres",
        "storage": "local SQLite (single embedding only)",
    }


@app.get("/face/status")
def face_status():
    return {"registered": template_status(), "storage": "local SQLite", "match_threshold": FACE_MATCH_THRESHOLD}


@app.post("/face/enroll")
def enroll(request: EnrollRequest):
    if template_status() and not request.replace_existing:
        raise HTTPException(status_code=409, detail="A face is already enrolled. Confirm replacement to register again.")
    image = decode_image(request.image)
    feature, _ = extract_face(image)
    with closing(sqlite3.connect(DB_PATH)) as connection:
        connection.execute(
            "INSERT INTO face_template (id, embedding) VALUES (1, ?) "
            "ON CONFLICT(id) DO UPDATE SET embedding=excluded.embedding, created_at=CURRENT_TIMESTAMP",
            (feature.astype("<f4").tobytes(),),
        )
        connection.commit()
    return {"success": True, "registered": True, "storage": "local SQLite", "message": "Face template saved on this booth."}


@app.post("/face/verify")
def verify(request: VerifyRequest):
    if not template_status():
        raise HTTPException(status_code=404, detail="No face is registered on this booth.")
    image = decode_image(request.image)
    feature, box = extract_face(image)
    with closing(sqlite3.connect(DB_PATH)) as connection:
        row = connection.execute("SELECT embedding FROM face_template WHERE id = 1").fetchone()
    enrolled = np.frombuffer(row[0], dtype="<f4").astype(np.float32)
    score = float(np.dot(feature, enrolled) / (np.linalg.norm(feature) * np.linalg.norm(enrolled)))
    matched = score >= FACE_MATCH_THRESHOLD

    depth_result = None
    if request.check_depth:
        if request.camera_source != "oak":
            depth_result = {"passed": False, "reason": "Stereo depth is available only with OAK-D Lite."}
        else:
            try:
                depth = oak_depth_frame()
                depth_result = evaluate_depth(depth, box, (image.shape[1], image.shape[0]))
            except RuntimeError as exc:
                depth_result = {"passed": False, "reason": str(exc)}

    return {
        "success": True,
        "matched": matched,
        "similarity": round(score, 4),
        "threshold": FACE_MATCH_THRESHOLD,
        "depth": depth_result,
        "message": "Enrolled face matched." if matched else "This face does not match the enrolled face.",
        "note": "Depth variation is a heuristic, not a guarantee against photo, video, mask or other presentation attacks.",
    }


@app.delete("/face/enrollment")
def delete_enrollment():
    with closing(sqlite3.connect(DB_PATH)) as connection:
        connection.execute("DELETE FROM face_template WHERE id = 1")
        connection.commit()
    return {"success": True, "registered": False, "message": "Local face template deleted."}
