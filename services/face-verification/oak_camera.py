from __future__ import annotations

import logging
import threading
import time
from datetime import timedelta
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)
PREVIEW_STREAMS = ("rgb", "left", "right", "rectified_left", "rectified_right", "disparity", "depth")
AUXILIARY_STREAMS = ("left", "right", "rectified_left", "rectified_right", "disparity")


class OakCameraError(RuntimeError):
    """Raised when the OAK-D Lite cannot provide RGB/depth frames."""


class OakCamera:
    """Single-owner OAK-D Lite camera shared by face verification and stream previews."""

    def __init__(self, width: int = 640, height: int = 480, fps: int = 15,
                 sync_threshold_ms: int = 50) -> None:
        self.width, self.height, self.fps = width, height, fps
        self.sync_threshold_ms = sync_threshold_ms
        self._lock = threading.RLock()
        self._condition = threading.Condition(self._lock)
        self._device: Any = None
        self._queue: Any = None
        self._preview_queues: dict[str, Any] = {}
        self._reader: threading.Thread | None = None
        self._running = False
        self._sequence = 0
        self._last_rgb: np.ndarray | None = None
        self._last_depth: np.ndarray | None = None
        self._preview_jpegs: dict[str, bytes] = {}
        self._preview_sequences = {name: 0 for name in PREVIEW_STREAMS}
        self._last_frame_at = 0.0
        self._error: str | None = None
        self._sdk_version: str | None = None
        self._device_id: str | None = None

    @staticmethod
    def _add_output(dai: Any, pipeline: Any, name: str, source: Any) -> None:
        output = pipeline.create(dai.node.XLinkOut)
        output.setStreamName(name)
        output.input.setBlocking(False)
        source.link(output.input)

    def _build_pipeline(self, dai: Any) -> Any:
        pipeline = dai.Pipeline()
        color = pipeline.create(dai.node.ColorCamera)
        color.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        color.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        color.setVideoSize(self.width, self.height)
        color.setFps(self.fps)
        color.setInterleaved(False)
        color.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)

        left = pipeline.create(dai.node.MonoCamera)
        left.setBoardSocket(dai.CameraBoardSocket.CAM_B)
        left.setResolution(dai.MonoCameraProperties.SensorResolution.THE_480_P)
        left.setFps(self.fps)
        right = pipeline.create(dai.node.MonoCamera)
        right.setBoardSocket(dai.CameraBoardSocket.CAM_C)
        right.setResolution(dai.MonoCameraProperties.SensorResolution.THE_480_P)
        right.setFps(self.fps)

        stereo = pipeline.create(dai.node.StereoDepth)
        stereo.setDefaultProfilePreset(dai.node.StereoDepth.PresetMode.HIGH_DENSITY)
        stereo.setLeftRightCheck(True)
        stereo.setDepthAlign(dai.CameraBoardSocket.CAM_A)
        stereo.setOutputSize(self.width, self.height)
        color.video.link(stereo.inputAlignTo)
        left.out.link(stereo.left)
        right.out.link(stereo.right)

        sync = pipeline.create(dai.node.Sync)
        sync.setSyncThreshold(timedelta(milliseconds=self.sync_threshold_ms))
        sync.setSyncAttempts(5)
        color.video.link(sync.inputs["rgb"])
        stereo.depth.link(sync.inputs["depth"])
        self._add_output(dai, pipeline, "rgb_depth", sync.out)

        sources = {
            "left": left.out, "right": right.out,
            "rectified_left": stereo.rectifiedLeft,
            "rectified_right": stereo.rectifiedRight,
            "disparity": stereo.disparity,
        }
        for name, source in sources.items():
            self._add_output(dai, pipeline, name, source)
        return pipeline

    @staticmethod
    def _encode_preview(name: str, frame: np.ndarray) -> bytes:
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
            raise OakCameraError(f"Could not encode {name} preview frame.")
        return encoded.tobytes()

    def start(self) -> None:
        with self._lock:
            if self._running and self._device is not None:
                return
            try:
                import depthai as dai
            except ImportError as exc:
                self._error = "DepthAI is not installed. Run uv sync in services/face-verification."
                raise OakCameraError(self._error) from exc
            try:
                if not dai.Device.getAllAvailableDevices():
                    raise OakCameraError("No DepthAI device detected. Check USB connection and udev permissions.")
                device = dai.Device(self._build_pipeline(dai))
                output_queue = device.getOutputQueue(name="rgb_depth", maxSize=4, blocking=False)
                preview_queues = {
                    name: device.getOutputQueue(name=name, maxSize=2, blocking=False)
                    for name in AUXILIARY_STREAMS
                }
                self._device, self._queue, self._preview_queues = device, output_queue, preview_queues
                self._sdk_version = getattr(dai, "__version__", "unknown")
                try:
                    self._device_id = device.getMxId()
                except Exception:
                    self._device_id = "connected OAK device"
                self._preview_jpegs.clear()
                self._preview_sequences = {name: 0 for name in PREVIEW_STREAMS}
                self._error = None
                self._running = True
                self._reader = threading.Thread(target=self._read_loop, name="oak-depthai-reader", daemon=True)
                self._reader.start()
                logger.info("Started DepthAI camera %s using SDK %s", self._device_id, self._sdk_version)
            except OakCameraError:
                raise
            except Exception as exc:
                self._running = False
                self._error = f"DepthAI could not start the OAK-D Lite pipeline: {exc}"
                self._close_device_locked()
                raise OakCameraError(self._error) from exc

    def _read_loop(self) -> None:
        while True:
            with self._lock:
                if not self._running:
                    return
                output_queue = self._queue
                preview_queues = dict(self._preview_queues)
            try:
                got_frame = False
                group = output_queue.tryGet() if output_queue is not None else None
                if group is not None:
                    rgb = group["rgb"].getCvFrame()
                    depth = group["depth"].getFrame()
                    if rgb is not None and depth is not None and rgb.size and depth.size:
                        rgb = np.ascontiguousarray(rgb)
                        depth = np.ascontiguousarray(depth, dtype=np.uint16)
                        if rgb.shape[:2] != depth.shape[:2]:
                            raise OakCameraError("DepthAI RGB/depth dimensions differ; verify CAM_A alignment.")
                        rgb_jpeg = self._encode_preview("rgb", rgb)
                        depth_jpeg = self._encode_preview("depth", depth)
                        with self._condition:
                            self._last_rgb, self._last_depth = rgb, depth
                            self._preview_jpegs.update(rgb=rgb_jpeg, depth=depth_jpeg)
                            self._preview_sequences["rgb"] += 1
                            self._preview_sequences["depth"] += 1
                            self._last_frame_at = time.monotonic()
                            self._sequence += 1
                            self._error = None
                            self._condition.notify_all()
                        got_frame = True

                for name, queue in preview_queues.items():
                    packet = queue.tryGet()
                    if packet is None:
                        continue
                    frame = packet.getCvFrame()
                    if frame is None or not frame.size:
                        continue
                    encoded = self._encode_preview(name, frame)
                    with self._lock:
                        self._preview_jpegs[name] = encoded
                        self._preview_sequences[name] += 1
                    got_frame = True
                if not got_frame:
                    time.sleep(0.004)
            except Exception as exc:
                with self._condition:
                    self._error = f"DepthAI frame capture failed: {exc}"
                    self._condition.notify_all()
                logger.exception("DepthAI frame reader failed")
                time.sleep(0.2)

    def get_frame_pair(self, timeout: float = 3.0,
                       after_sequence: int | None = None) -> tuple[np.ndarray, np.ndarray, int]:
        self.start()
        deadline = time.monotonic() + timeout
        with self._condition:
            target = self._sequence if after_sequence is None else after_sequence
            while self._sequence <= target or self._last_rgb is None or self._last_depth is None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise OakCameraError(self._error or "No synchronized RGB/depth frame arrived before timeout.")
                self._condition.wait(timeout=min(remaining, 0.25))
                if not self._running:
                    raise OakCameraError(self._error or "DepthAI camera stopped.")
            age = time.monotonic() - self._last_frame_at
            if age > 2.0:
                raise OakCameraError(f"The most recent OAK frame is stale ({age:.1f}s old).")
            return self._last_rgb.copy(), self._last_depth.copy(), self._sequence

    def get_preview_frame(self, name: str) -> bytes | None:
        if name not in PREVIEW_STREAMS:
            raise OakCameraError(f"Unknown OAK preview stream: {name}")
        self.start()
        with self._lock:
            return self._preview_jpegs.get(name)

    def preview_status(self) -> list[dict[str, Any]]:
        with self._lock:
            return [{"name": name, "ready": name in self._preview_jpegs,
                     "sequence": self._preview_sequences[name]} for name in PREVIEW_STREAMS]

    def status(self, probe: bool = True) -> dict[str, Any]:
        if probe:
            try:
                self.get_frame_pair(timeout=3.0)
            except OakCameraError:
                pass
        with self._lock:
            fresh = self._last_rgb is not None and time.monotonic() - self._last_frame_at <= 2.0
            available = self._running and fresh
            return {
                "available": available, "backend": "depthai", "device_id": self._device_id,
                "sdk_version": self._sdk_version, "rgb": available, "depth": available,
                "resolution": f"{self.width}x{self.height}", "fps": self.fps,
                "synchronized": True, "depth_aligned_to": "RGB / CAM_A",
                "available_streams": self.preview_status(),
                "error": None if available else self._error or "Waiting for the first synchronized RGB/depth frame.",
            }

    def stop(self) -> None:
        with self._condition:
            self._running = False
            self._condition.notify_all()
            reader, self._reader = self._reader, None
            self._close_device_locked()
        if reader and reader.is_alive() and reader is not threading.current_thread():
            reader.join(timeout=2.0)

    def _close_device_locked(self) -> None:
        device = self._device
        self._device = None
        self._queue = None
        self._preview_queues.clear()
        if device is not None:
            try:
                device.close()
            except Exception:
                logger.debug("Error while closing DepthAI device", exc_info=True)
