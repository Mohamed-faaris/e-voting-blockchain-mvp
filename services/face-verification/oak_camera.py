from __future__ import annotations

import logging
import threading
import time
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class OakCameraError(RuntimeError):
    """Raised when the OAK-D Lite cannot provide camera frames."""


class OakCamera:
    """Single-owner DepthAI v2 camera session with independent RGB/depth queues.

    The pipeline follows Luxonis' official DepthAI v2 examples:
    ColorCamera -> XLinkOut for RGB and MonoCamera L/R -> StereoDepth -> XLinkOut
    for depth. RGB is deliberately kept independent from stereo depth startup.
    """

    def __init__(self, width: int = 640, height: int = 480, fps: int = 15) -> None:
        self.width = width
        self.height = height
        self.fps = fps
        self._lock = threading.RLock()
        self._condition = threading.Condition(self._lock)
        self._device: Any = None
        self._rgb_queue: Any = None
        self._depth_queue: Any = None
        self._reader: threading.Thread | None = None
        self._running = False
        self._rgb: np.ndarray | None = None
        self._depth: np.ndarray | None = None
        self._rgb_at = 0.0
        self._depth_at = 0.0
        self._sequence = 0
        self._sdk_version: str | None = None
        self._device_id: str | None = None
        self._rgb_error: str | None = None
        self._depth_error: str | None = None

    def _build_pipeline(self, dai: Any) -> Any:
        pipeline = dai.Pipeline()

        # Luxonis ColorCamera example pattern: a standalone RGB output queue.
        color = pipeline.create(dai.node.ColorCamera)
        color.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        color.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        color.setVideoSize(self.width, self.height)
        color.setFps(self.fps)
        color.setInterleaved(False)
        color.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
        rgb_out = pipeline.create(dai.node.XLinkOut)
        rgb_out.setStreamName("rgb")
        color.video.link(rgb_out.input)

        # Luxonis StereoDepth example pattern: independent mono pair and depth output.
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
        left.out.link(stereo.left)
        right.out.link(stereo.right)

        depth_out = pipeline.create(dai.node.XLinkOut)
        depth_out.setStreamName("depth")
        stereo.depth.link(depth_out.input)
        return pipeline

    def start(self) -> None:
        with self._lock:
            if self._running and self._device is not None:
                return
            try:
                import depthai as dai
            except ImportError as exc:
                message = "DepthAI is not installed. Run uv sync in services/face-verification."
                self._rgb_error = self._depth_error = message
                raise OakCameraError(message) from exc

            try:
                devices = dai.Device.getAllAvailableDevices()
                if not devices:
                    raise OakCameraError(
                        "No DepthAI device detected. Check USB data cable, power, udev permissions and connection."
                    )
                device = dai.Device(self._build_pipeline(dai))
                self._device = device
                self._rgb_queue = device.getOutputQueue("rgb", maxSize=4, blocking=False)
                self._depth_queue = device.getOutputQueue("depth", maxSize=4, blocking=False)
                self._sdk_version = getattr(dai, "__version__", "unknown")
                try:
                    self._device_id = device.getMxId()
                except Exception:
                    self._device_id = "connected OAK device"
                self._rgb_error = self._depth_error = None
                self._running = True
                self._reader = threading.Thread(target=self._read_loop, name="oak-depthai-reader", daemon=True)
                self._reader.start()
                logger.info("Started OAK-D Lite %s with DepthAI %s", self._device_id, self._sdk_version)
            except OakCameraError:
                raise
            except Exception as exc:
                self._close_device_locked()
                self._running = False
                message = f"DepthAI pipeline startup failed: {exc}"
                self._rgb_error = self._depth_error = message
                raise OakCameraError(message) from exc

    def _read_loop(self) -> None:
        while True:
            with self._lock:
                if not self._running:
                    return
                rgb_queue, depth_queue = self._rgb_queue, self._depth_queue

            try:
                rgb_message = rgb_queue.tryGet() if rgb_queue is not None else None
                if rgb_message is not None:
                    frame = rgb_message.getCvFrame()
                    if frame is not None and frame.size:
                        with self._condition:
                            self._rgb = np.ascontiguousarray(frame)
                            self._rgb_at = time.monotonic()
                            self._sequence += 1
                            self._rgb_error = None
                            self._condition.notify_all()
            except Exception as exc:
                with self._condition:
                    self._rgb_error = f"RGB queue failed: {exc}"
                    self._condition.notify_all()
                logger.exception("OAK RGB reader failed")

            try:
                depth_message = depth_queue.tryGet() if depth_queue is not None else None
                if depth_message is not None:
                    frame = depth_message.getFrame()
                    if frame is not None and frame.size:
                        with self._condition:
                            self._depth = np.ascontiguousarray(frame, dtype=np.uint16)
                            self._depth_at = time.monotonic()
                            self._depth_error = None
                            self._condition.notify_all()
            except Exception as exc:
                with self._condition:
                    self._depth_error = f"Stereo depth queue failed: {exc}"
                    self._condition.notify_all()
                logger.exception("OAK depth reader failed")

            time.sleep(0.002)

    def get_rgb_frame(self, timeout: float = 3.0, after_sequence: int | None = None) -> tuple[np.ndarray, int]:
        self.start()
        deadline = time.monotonic() + timeout
        with self._condition:
            initial = self._sequence if after_sequence is None else after_sequence
            while self._rgb is None or self._rgb_at == 0 or (after_sequence is not None and self._sequence <= initial):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise OakCameraError(self._rgb_error or "No RGB frame received before timeout.")
                self._condition.wait(min(remaining, 0.2))
            if time.monotonic() - self._rgb_at > 2:
                raise OakCameraError("OAK RGB frame is stale.")
            return self._rgb.copy(), self._sequence

    def get_depth_frame(self, timeout: float = 3.0) -> np.ndarray:
        self.start()
        deadline = time.monotonic() + timeout
        with self._condition:
            while self._depth is None or self._depth_at == 0:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise OakCameraError(self._depth_error or "No stereo depth frame received before timeout.")
                self._condition.wait(min(remaining, 0.2))
            if time.monotonic() - self._depth_at > 2:
                raise OakCameraError("OAK stereo depth frame is stale.")
            return self._depth.copy()

    def get_frame_pair(self, timeout: float = 3.0, after_sequence: int | None = None) -> tuple[np.ndarray, np.ndarray, int]:
        rgb, sequence = self.get_rgb_frame(timeout=timeout, after_sequence=after_sequence)
        depth = self.get_depth_frame(timeout=timeout)
        if rgb.shape[:2] != depth.shape[:2]:
            raise OakCameraError(
                f"RGB/depth dimensions differ: RGB={rgb.shape[1]}x{rgb.shape[0]}, "
                f"depth={depth.shape[1]}x{depth.shape[0]}."
            )
        return rgb, depth, sequence

    def status(self, probe: bool = True) -> dict[str, Any]:
        if probe:
            try:
                self.start()
                # Wait briefly for each queue independently; RGB must not depend on depth.
                try:
                    self.get_rgb_frame(timeout=1.5)
                except OakCameraError:
                    pass
                try:
                    self.get_depth_frame(timeout=1.5)
                except OakCameraError:
                    pass
            except OakCameraError:
                pass
        with self._lock:
            now = time.monotonic()
            rgb_ok = self._running and self._rgb is not None and now - self._rgb_at <= 2
            depth_ok = self._running and self._depth is not None and now - self._depth_at <= 2
            return {
                "available": rgb_ok,
                "backend": "depthai-v2",
                "device_id": self._device_id,
                "sdk_version": self._sdk_version,
                "rgb": rgb_ok,
                "depth": depth_ok,
                "resolution": f"{self.width}x{self.height}",
                "fps": self.fps,
                "synchronized": False,
                "depth_aligned_to": "RGB / CAM_A",
                "rgb_error": None if rgb_ok else self._rgb_error or "No fresh RGB frame.",
                "depth_error": None if depth_ok else self._depth_error or "No fresh stereo depth frame.",
                "error": None if rgb_ok and depth_ok else self._rgb_error or self._depth_error,
            }

    def stop(self) -> None:
        with self._condition:
            self._running = False
            self._condition.notify_all()
            reader = self._reader
            self._reader = None
            self._close_device_locked()
        if reader and reader.is_alive() and reader is not threading.current_thread():
            reader.join(timeout=2)

    def _close_device_locked(self) -> None:
        device = self._device
        self._device = None
        self._rgb_queue = None
        self._depth_queue = None
        if device is not None:
            try:
                device.close()
            except Exception:
                logger.debug("Error closing DepthAI device", exc_info=True)
