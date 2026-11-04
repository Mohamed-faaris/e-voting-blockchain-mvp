from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import cv2
import depthai as dai
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("depthai-stream-server")
STREAM_NAMES = ("rgb", "left", "right", "rectified_left", "rectified_right", "disparity", "depth")


class DepthAIStreamHub:
    """Single owner of the OAK device; serves preview JPEGs and raw depth frames."""

    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.device: Any = None
        self.queues: dict[str, Any] = {}
        self.frames: dict[str, bytes] = {}
        self.raw_frames: dict[str, np.ndarray] = {}
        self.reader: threading.Thread | None = None
        self.running = False
        self.error: str | None = None
        self.device_id: str | None = None
        self.sequence = {name: 0 for name in STREAM_NAMES}
        self.fps_count = 0
        self.fps_started = time.monotonic()
        self.fps = 0.0

    def build_pipeline(self) -> dai.Pipeline:
        pipeline = dai.Pipeline()
        rgb = pipeline.create(dai.node.ColorCamera)
        rgb.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        rgb.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        rgb.setVideoSize(640, 480)
        rgb.setFps(15)
        rgb.setInterleaved(False)
        rgb.setColorOrder(dai.CameraBoardSocket.CAM_A and dai.ColorCameraProperties.ColorOrder.BGR)

        left = pipeline.create(dai.node.MonoCamera)
        left.setBoardSocket(dai.CameraBoardSocket.CAM_B)
        left.setResolution(dai.MonoCameraProperties.SensorResolution.THE_480_P)
        left.setFps(15)
        right = pipeline.create(dai.node.MonoCamera)
        right.setBoardSocket(dai.CameraBoardSocket.CAM_C)
        right.setResolution(dai.MonoCameraProperties.SensorResolution.THE_480_P)
        right.setFps(15)

        stereo = pipeline.create(dai.node.StereoDepth)
        stereo.setDefaultProfilePreset(dai.node.StereoDepth.PresetMode.HIGH_DENSITY)
        stereo.setLeftRightCheck(True)
        stereo.setSubpixel(False)
        stereo.setExtendedDisparity(False)
        stereo.setDepthAlign(dai.CameraBoardSocket.CAM_A)
        stereo.setOutputSize(640, 480)
        left.out.link(stereo.left)
        right.out.link(stereo.right)

        outputs = {
            "rgb": rgb.video,
            "left": left.out,
            "right": right.out,
            "rectified_left": stereo.rectifiedLeft,
            "rectified_right": stereo.rectifiedRight,
            "disparity": stereo.disparity,
            "depth": stereo.depth,
        }
        for name, source in outputs.items():
            out = pipeline.create(dai.node.XLinkOut)
            out.setStreamName(name)
            out.input.setBlocking(False)
            source.link(out.input)
        return pipeline

    def start(self) -> None:
        with self.lock:
            if self.running:
                return
            if not dai.Device.getAllAvailableDevices():
                self.error = (
                    "No DepthAI device detected. Connect the OAK-D Lite over USB, "
                    "check its cable and udev permissions, then retry."
                )
                raise RuntimeError(self.error)
            device = None
            try:
                device = dai.Device(self.build_pipeline())
                queues = {
                    name: device.getOutputQueue(name=name, maxSize=2, blocking=False)
                    for name in STREAM_NAMES
                }
                self.device = device
                self.queues = queues
                self.device_id = device.getMxId()
                self.frames.clear()
                self.raw_frames.clear()
                self.sequence = {name: 0 for name in STREAM_NAMES}
                self.error = None
                self.running = True
                self.fps_count = 0
                self.fps_started = time.monotonic()
                self.reader = threading.Thread(target=self._capture_loop, daemon=True)
                self.reader.start()
                logger.info("DepthAI device %s started", self.device_id)
            except Exception:
                self.running = False
                if device is not None:
                    device.close()
                self.device = None
                raise

    @staticmethod
    def encode(name: str, frame: np.ndarray) -> bytes:
        if name == "depth":
            clipped = np.clip(frame.astype(np.float32), 0, 5000)
            gray = (clipped * (255.0 / 5000)).astype(np.uint8)
            rendered = cv2.applyColorMap(gray, cv2.COLORMAP_TURBO)
            rendered[frame == 0] = (0, 0, 0)
        elif name == "disparity":
            gray = cv2.normalize(frame, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            rendered = cv2.applyColorMap(gray, cv2.COLORMAP_JET)
        elif frame.ndim == 2:
            rendered = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        else:
            rendered = frame
        ok, encoded = cv2.imencode(".jpg", rendered, [cv2.IMWRITE_JPEG_QUALITY, 82])
        if not ok:
            raise RuntimeError("Could not encode " + name + " frame")
        return encoded.tobytes()

    def _capture_loop(self) -> None:
        while self.running:
            got_frame = False
            try:
                for name, queue in list(self.queues.items()):
                    packet = queue.tryGet()
                    if packet is None:
                        continue
                    frame = packet.getCvFrame()
                    if frame is None or frame.size == 0:
                        continue
                    jpeg = self.encode(name, frame)
                    with self.lock:
                        # Keep a native copy: depth must remain uint16 millimetres,
                        # not the colorized JPEG used by the preview page.
                        self.raw_frames[name] = np.ascontiguousarray(frame).copy()
                        self.frames[name] = jpeg
                        self.sequence[name] += 1
                    got_frame = True
                if got_frame:
                    self.fps_count += 1
                    now = time.monotonic()
                    elapsed = now - self.fps_started
                    if elapsed >= 2:
                        self.fps = self.fps_count / elapsed
                        self.fps_count = 0
                        self.fps_started = now
                else:
                    time.sleep(0.003)
            except Exception as exc:
                logger.exception("DepthAI capture loop error")
                with self.lock:
                    self.error = str(exc)
                time.sleep(0.2)

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            rgb_ready = "rgb" in self.frames
            depth_ready = "depth" in self.raw_frames
            return {
                "connected": self.running and (rgb_ready or depth_ready),
                "device_id": self.device_id,
                "sdk_version": getattr(dai, "__version__", "unknown"),
                "fps": round(self.fps, 1),
                "available_streams": [
                    {"name": n, "ready": n in self.frames, "sequence": self.sequence[n]}
                    for n in STREAM_NAMES
                ],
                "rgb_available": rgb_ready,
                "depth_available": depth_ready,
                "error": self.error,
            }

    def get_frame(self, name: str) -> bytes | None:
        with self.lock:
            return self.frames.get(name)

    def get_raw_frame(self, name: str) -> np.ndarray | None:
        with self.lock:
            frame = self.raw_frames.get(name)
            return frame.copy() if frame is not None else None

    def stop(self) -> None:
        with self.lock:
            self.running = False
            reader, self.reader = self.reader, None
            device, self.device = self.device, None
            self.queues.clear()
        if reader and reader.is_alive():
            reader.join(timeout=2)
        if device is not None:
            device.close()


hub = DepthAIStreamHub()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        hub.start()
    except Exception as exc:
        logger.error("DepthAI startup failed: %s", exc)
    yield
    hub.stop()


app = FastAPI(title="DepthAI Stream Server", version="0.2.0", lifespan=lifespan)


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return (Path(__file__).parent / "static" / "index.html").read_text(encoding="utf-8")


@app.get("/api/status")
def status() -> dict[str, Any]:
    return hub.snapshot()


@app.post("/api/reconnect")
def reconnect() -> dict[str, Any]:
    hub.stop()
    try:
        hub.start()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"ok": True, "status": hub.snapshot()}


@app.get("/streams/{name}.jpg")
def stream_frame(name: str) -> Response:
    if name not in STREAM_NAMES:
        raise HTTPException(status_code=404, detail="Unknown stream")
    frame = hub.get_frame(name)
    if frame is None:
        raise HTTPException(status_code=503, detail="Stream has not produced a frame yet")
    return Response(frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@app.get("/api/frame/depth.png")
def raw_depth_frame() -> Response:
    """Return the uncolorized, aligned 16-bit depth image in millimetres."""
    frame = hub.get_raw_frame("depth")
    if frame is None:
        raise HTTPException(status_code=503, detail="Stereo depth has not produced a frame yet")
    if frame.dtype != np.uint16:
        frame = frame.astype(np.uint16, copy=False)
    ok, encoded = cv2.imencode(".png", frame)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode raw depth frame")
    return Response(encoded.tobytes(), media_type="image/png", headers={"Cache-Control": "no-store"})


@app.get("/health")
def health() -> dict[str, Any]:
    state = hub.snapshot()
    return {"ok": True, "device_connected": state["connected"], "rgb_available": state["rgb_available"],
            "depth_available": state["depth_available"]}
