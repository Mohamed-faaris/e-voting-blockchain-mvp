from __future__ import annotations

import base64
import json
import os
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from oak_camera import OakCamera, OakCameraError

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
OAK_RGB_WIDTH = int(os.getenv("OAK_RGB_WIDTH", "640"))
OAK_RGB_HEIGHT = int(os.getenv("OAK_RGB_HEIGHT", "480"))
OAK_STREAM_FPS = max(1, min(30, int(os.getenv("OAK_STREAM_FPS", "15"))))
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.363"))
MAX_IMAGE_BYTES = 8 * 1024 * 1024

DETECTOR_MODEL = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
RECOGNIZER_MODEL = MODEL_DIR / "face_recognition_sface_2021dec.onnx"


DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Civic Ledger · Face Service</title>
<style>
:root{color-scheme:dark;--bg:#0b1220;--panel:#121d30;--line:#263750;--muted:#9aabc2;--text:#edf4ff;--green:#34d399;--red:#fb7185;--amber:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0%,#172b48 0,transparent 35%),var(--bg);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 22px 56px}.top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:24px}
h1{font-size:25px;margin:0 0 5px}.sub{color:var(--muted)}.pill{border:1px solid var(--line);border-radius:99px;padding:7px 12px;color:var(--muted);font-size:12px}
.grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(270px,1fr);gap:18px}.panel{background:linear-gradient(145deg,#152238,#101a2b);border:1px solid var(--line);border-radius:16px;padding:18px;min-width:0}
h2{font-size:15px;margin:0 0 14px}.video{background:#050a12;border:1px solid var(--line);border-radius:11px;overflow:hidden;aspect-ratio:4/3;display:grid;place-items:center}.video img{width:100%;height:100%;object-fit:contain}.hint{color:var(--muted);font-size:12px;margin-top:10px}
.metrics{display:grid;gap:10px}.metric{padding:12px;border:1px solid var(--line);border-radius:10px;background:#0c1626}.metric span{display:block;color:var(--muted);font-size:11px}.metric strong{display:block;margin-top:4px;font-size:14px;overflow-wrap:anywhere}
.ok{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--amber)}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
a,button{border:1px solid #365071;background:#1a2b43;color:var(--text);border-radius:9px;padding:9px 12px;text-decoration:none;font:inherit;font-size:12px;cursor:pointer}a:hover,button:hover{background:#263e5e}
.endpoints{display:grid;gap:9px}.endpoint{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:8px 0}.endpoint code{color:#b8d5ff;font-size:11px}.footer{color:var(--muted);font-size:11px;margin-top:20px}
@media(max-width:800px){.grid{grid-template-columns:1fr}main{padding:20px 14px}}
</style>
</head>
<body><main>
<header class="top"><div><h1>Civic Ledger · Face Service</h1><div class="sub">Local camera, face recognition and direct OAK-D Lite DepthAI dashboard</div></div><div class="pill" id="overall">Checking service…</div></header>
<section class="grid">
<div class="panel"><h2>Live OAK RGB · Face detection</h2><div class="video"><img id="stream" src="/camera/oak/stream.mjpg" alt="OAK RGB live stream with face bounding boxes" onerror="this.style.display='none';document.getElementById('streamError').hidden=false"><div id="streamError" class="sub" hidden>Stream unavailable. Check the OAK-D Lite USB connection and DepthAI status.</div></div><div class="hint">YuNet draws face bounding boxes. When a template is enrolled, SFace labels faces ENROLLED or UNKNOWN. This preview is not liveness proof.</div><div class="actions"><button onclick="reloadStream()">Reconnect stream</button><a href="/camera/oak/snapshot" target="_blank" rel="noreferrer">Open snapshot</a><a href="/docs" target="_blank" rel="noreferrer">API docs</a></div></div>
<div class="panel"><h2>Service status</h2><div class="metrics">
<div class="metric"><span>FastAPI</span><strong id="apiStatus">Checking…</strong></div>
<div class="metric"><span>Face models</span><strong id="modelStatus">Checking…</strong></div>
<div class="metric"><span>Local enrollment</span><strong id="faceStatus">Checking…</strong></div>
<div class="metric"><span>OAK RGB camera</span><strong id="rgbStatus">Checking…</strong></div>
<div class="metric"><span>OAK stereo depth</span><strong id="depthStatus">Checking…</strong></div>
</div><div class="actions"><button onclick="refreshStatus()">Refresh diagnostics</button></div></div>
<div class="panel"><h2>Camera diagnostics</h2><div class="metrics"><div class="metric"><span>RGB device</span><strong id="rgbDevice">—</strong></div><div class="metric"><span>Depth source</span><strong id="depthSocket">—</strong></div><div class="metric"><span>Match threshold</span><strong id="threshold">—</strong></div></div></div>
<div class="panel"><h2>API endpoints</h2><div class="endpoints">
<div class="endpoint"><code>GET /health</code><a href="/health">Open</a></div>
<div class="endpoint"><code>GET /face/status</code><a href="/face/status">Open</a></div>
<div class="endpoint"><code>GET /camera/oak/status</code><a href="/camera/oak/status">Open</a></div>
<div class="endpoint"><code>GET /camera/oak/stream.mjpg</code><a href="/camera/oak/stream.mjpg" target="_blank">Open</a></div>
<div class="endpoint"><code>GET /camera/oak/snapshot</code><a href="/camera/oak/snapshot" target="_blank">Open</a></div>
<div class="endpoint"><code>OpenAPI</code><a href="/openapi.json">JSON</a></div>
</div></div>
</section><div class="footer">Runs locally on the booth machine. Face embeddings remain in local SQLite. Recognition and stereo-depth checks are prototype diagnostics, not certified biometric security.</div>
</main>
<script>
async function getJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' returned '+r.status);return r.json()}
function set(id,text,kind){const e=document.getElementById(id);e.textContent=text;e.className=kind||''}
async function refreshStatus(){
try{
const [health,face,oak]=await Promise.all([getJson('/health'),getJson('/face/status'),getJson('/camera/oak/status')]);
set('apiStatus','Online','ok');set('modelStatus',health.models_available?'Available':'Missing',health.models_available?'ok':'bad');
set('faceStatus',face.registered?'One face enrolled':'No face enrolled',face.registered?'ok':'warn');
set('rgbStatus',oak.rgb.available?'Connected':'Unavailable',oak.rgb.available?'ok':'bad');
set('depthStatus',oak.depth.available?'Connected':'Unavailable',oak.depth.available?'ok':'bad');
set('rgbDevice',oak.rgb.device||'—');set('depthSocket',oak.depth.socket||'—');set('threshold',(face.match_threshold*100).toFixed(1)+'%');
set('overall',oak.ready?'OAK-D Lite ready':'Service online · DepthAI camera needs attention',oak.ready?'ok':'warn');
}catch(e){set('apiStatus','Unavailable','bad');set('overall','Service or DepthAI camera error','bad');console.error(e)}
}
function reloadStream(){const img=document.getElementById('stream');document.getElementById('streamError').hidden=true;img.style.display='block';img.src='/camera/oak/stream.mjpg?t='+Date.now()}
refreshStatus();setInterval(refreshStatus,10000);
</script></body></html>"""


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
    image: str | None = Field(default=None, min_length=32)
    camera_source: Literal["webcam", "oak"] = "webcam"


class EnrollRequest(ImageRequest):
    replace_existing: bool = False


class VerifyRequest(ImageRequest):
    check_depth: bool = False


OAK_CAMERA = OakCamera(width=OAK_RGB_WIDTH, height=OAK_RGB_HEIGHT, fps=OAK_STREAM_FPS)


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


def request_frames(request: ImageRequest) -> tuple[np.ndarray, np.ndarray | None]:
    """Get one RGB frame and, for OAK, its synchronized RGB-aligned depth frame."""
    if request.camera_source == "oak":
        try:
            rgb, depth, _sequence = OAK_CAMERA.get_frame_pair(timeout=3.0)
            return rgb, depth
        except OakCameraError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    if not request.image:
        raise HTTPException(status_code=422, detail="A base64 browser camera image is required for webcam mode.")
    return decode_image(request.image), None


def template_status() -> bool:
    with closing(sqlite3.connect(DB_PATH)) as connection:
        return connection.execute("SELECT 1 FROM face_template WHERE id = 1").fetchone() is not None


@app.on_event("startup")
def startup():
    init_db()


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def dashboard():
    return HTMLResponse(DASHBOARD_HTML)


@app.get("/health")
def health():
    oak = OAK_CAMERA.status(probe=True)
    return {
        "ok": True,
        "models_available": DETECTOR_MODEL.exists() and RECOGNIZER_MODEL.exists(),
        "face_registered": template_status(),
        "camera_backend": "DepthAI direct SDK",
        "oak": oak,
        "storage": "local SQLite (single embedding only)",
    }


@app.get("/face/status")
def face_status():
    return {"registered": template_status(), "storage": "local SQLite", "match_threshold": FACE_MATCH_THRESHOLD}


@app.post("/face/enroll")
def enroll(request: EnrollRequest):
    if template_status() and not request.replace_existing:
        raise HTTPException(status_code=409, detail="A face is already enrolled. Confirm replacement to register again.")
    image, _depth = request_frames(request)
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
    image, depth = request_frames(request)
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
        elif depth is None:
            depth_result = {"passed": False, "unavailable": True, "reason": "DepthAI did not provide a synchronized depth frame."}
        else:
            depth_result = evaluate_depth(depth, box, (image.shape[1], image.shape[0]))

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


def annotated_oak_frame(frame: np.ndarray) -> np.ndarray:
    """Draw face boxes and SFace labels over a frame received from DepthAI."""
    height, width = frame.shape[:2]
    detector, recognizer = models()
    detector.setInputSize((width, height))
    _, faces = detector.detect(frame)
    if faces is None or len(faces) == 0:
        cv2.putText(
            frame,
            "NO FACE DETECTED",
            (16, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 165, 255),
            2,
        )
        return frame

    enrolled = None
    if template_status():
        with closing(sqlite3.connect(DB_PATH)) as connection:
            row = connection.execute("SELECT embedding FROM face_template WHERE id = 1").fetchone()
        if row:
            enrolled = np.frombuffer(row[0], dtype="<f4").astype(np.float32)

    for face in faces:
        x, y, box_w, box_h = [int(round(value)) for value in face[:4]]
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(width, x + box_w), min(height, y + box_h)
        label = "FACE DETECTED"
        color = (0, 200, 255)
        if enrolled is not None:
            aligned = recognizer.alignCrop(frame, face)
            feature = recognizer.feature(aligned).astype(np.float32).reshape(-1)
            norm = float(np.linalg.norm(feature))
            if norm > 0:
                feature /= norm
                score = float(np.dot(feature, enrolled) / max(float(np.linalg.norm(enrolled)), 1e-8))
                matched = score >= FACE_MATCH_THRESHOLD
                label = f"{'ENROLLED' if matched else 'UNKNOWN'} {score:.2f}"
                color = (0, 200, 0) if matched else (0, 0, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            frame,
            label,
            (x1, max(22, y1 - 9)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
        )
    return frame


def oak_device_status():
    status = OAK_CAMERA.status(probe=True)
    error = status.get("error")
    return {
        "backend": "depthai",
        "rgb": {
            "available": status["rgb"],
            "device": f"DepthAI CAM_A ({status['device_id'] or 'OAK-D Lite'})",
            "error": error,
        },
        "depth": {
            "available": status["depth"],
            "socket": "DepthAI StereoDepth synchronized output",
            "error": error,
        },
        "ready": status["available"],
        "device_id": status["device_id"],
        "sdk_version": status["sdk_version"],
        "resolution": status["resolution"],
        "fps": status["fps"],
        "synchronized": status["synchronized"],
        "depth_aligned_to": status["depth_aligned_to"],
    }


@app.get("/camera/oak/status")
def oak_camera_status():
    return oak_device_status()


@app.get("/camera/oak/snapshot")
def oak_camera_snapshot():
    try:
        frame, _depth, _sequence = OAK_CAMERA.get_frame_pair(timeout=3.0)
        ok, encoded = cv2.imencode(".jpg", annotated_oak_frame(frame))
        if not ok:
            raise HTTPException(status_code=500, detail="Could not encode OAK camera frame.")
        return Response(
            content=encoded.tobytes(),
            media_type="image/jpeg",
            headers={"Cache-Control": "no-store"},
        )
    except OakCameraError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def oak_mjpeg_generator():
    """Stream frames captured directly through the DepthAI SDK."""
    sequence = 0
    frame_delay = 1.0 / OAK_STREAM_FPS
    while True:
        started = time.monotonic()
        try:
            frame, _depth, sequence = OAK_CAMERA.get_frame_pair(
                timeout=4.0,
                after_sequence=sequence,
            )
            try:
                annotated = annotated_oak_frame(frame)
            except Exception as exc:
                annotated = frame
                cv2.putText(
                    annotated,
                    f"FACE ANALYSIS ERROR: {str(exc)[:70]}",
                    (12, 28),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.48,
                    (0, 0, 255),
                    2,
                )
            ok, encoded = cv2.imencode(
                ".jpg",
                annotated,
                [cv2.IMWRITE_JPEG_QUALITY, 80],
            )
            if not ok:
                continue
            yield (
                b"--frame\r\nContent-Type: image/jpeg\r\n"
                b"Cache-Control: no-store\r\n\r\n"
                + encoded.tobytes()
                + b"\r\n"
            )
        except OakCameraError as exc:
            error_frame = np.zeros((240, 640, 3), dtype=np.uint8)
            cv2.putText(
                error_frame,
                f"DEPTHAI CAMERA ERROR: {str(exc)[:65]}",
                (10, 120),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 0, 255),
                2,
            )
            ok, encoded = cv2.imencode(".jpg", error_frame)
            if ok:
                yield (
                    b"--frame\r\nContent-Type: image/jpeg\r\n"
                    b"Cache-Control: no-store\r\n\r\n"
                    + encoded.tobytes()
                    + b"\r\n"
                )
            break

        remaining = frame_delay - (time.monotonic() - started)
        if remaining > 0:
            time.sleep(remaining)


@app.get("/camera/oak/stream.mjpg")
def oak_camera_stream():
    try:
        OAK_CAMERA.start()
    except OakCameraError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return StreamingResponse(
        oak_mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.on_event("shutdown")
def shutdown_oak_camera():
    OAK_CAMERA.stop()
