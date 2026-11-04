from __future__ import annotations

import logging
import threading
import time
from datetime import timedelta
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class OakCameraError(RuntimeError):
    """Raised when the OAK-D Lite cannot provide RGB/depth frames."""


class OakCamera:
    """Own an OAK-D Lite directly through the DepthAI v2 SDK.

    The RGB image and stereo depth map are aligned to the RGB camera and
    synchronized in the device pipeline. No UVC virtual camera or Unix socket
    bridge is used.
    """

    def __init__(
        self,
        width: int = 640,
        height: int = 480,
        fps: int = 15,
        sync_threshold_ms: int = 50,
    ) -> None:
        self.width = width
        self.height = height
        self.fps = fps
        self.sync_threshold_ms = sync_threshold_ms

        self._lock = threading.RLock()
        self._condition = threading.Condition(self._lock)
        self._device: Any = None
        self._queue: Any = None
        self._reader: threading.Thread | None = None
        self._running = False
        self._sequence = 0
        self._last_rgb: np.ndarray | None = None
        self._last_depth: np.ndarray | None = None
        self._last_frame_at = 0.0
        self._error: str | None = None
        self._sdk_version: str | None = None
        self._device_id: str | None = None

    def _build_pipeline(self, dai: Any) -> Any:
        pipeline = dai.Pipeline()

        # OAK-D Lite RGB sensor (CAM_A / IMX214).
        color = pipeline.create(dai.node.ColorCamera)
        color.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        color.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        color.setVideoSize(self.width, self.height)
        color.setFps(self.fps)
        color.setInterleaved(False)
        color.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)

        # OAK-D Lite stereo pair (OV7251 mono sensors).
        left = pipeline.create(dai.node.MonoCamera)
        left.setBoardSocket(dai.CameraBoardSocket.LEFT)
        left.setResolution(dai.MonoCameraProperties.SensorResolution.THE_480_P)
        left.setFps(self.fps)

        right = pipeline.create(dai.node.MonoCamera)
        right.setBoardSocket(dai.CameraBoardSocket.RIGHT)
        right.setResolution(dai.MonoCameraProperties.SensorResolution.THE_480_P)
        right.setFps(self.fps)

        stereo = pipeline.create(dai.node.StereoDepth)
        stereo.setDefaultProfilePreset(dai.node.StereoDepth.PresetMode.HIGH_DENSITY)
        stereo.setLeftRightCheck(True)
        stereo.setDepthAlign(dai.CameraBoardSocket.CAM_A)
        stereo.setOutputSize(self.width, self.height)

        left.out.link(stereo.left)
        right.out.link(stereo.right)

        # Pair each RGB image with its corresponding RGB-aligned depth frame.
        sync = pipeline.create(dai.node.Sync)
        sync.setSyncThreshold(timedelta(milliseconds=self.sync_threshold_ms))
        sync.setSyncAttempts(5)
        color.video.link(sync.inputs["rgb"])
        stereo.depth.link(sync.inputs["depth"])

        output = pipeline.create(dai.node.XLinkOut)
        output.setStreamName("rgb_depth")
        sync.out.link(output.input)
        return pipeline

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
                available = dai.Device.getAllAvailableDevices()
                if not available:
                    raise OakCameraError(
                        "No DepthAI device detected. Check the OAK-D Lite USB connection, "
                        "USB cable, udev permissions, and device power."
                    )

                pipeline = self._build_pipeline(dai)
                device = dai.Device(pipeline)
                output_queue = device.getOutputQueue(
                    name="rgb_depth",
                    maxSize=4,
                    blocking=False,
                )

                self._device = device
                self._queue = output_queue
                self._sdk_version = getattr(dai, "__version__", "unknown")
                try:
                    self._device_id = device.getMxId()
                except Exception:
                    self._device_id = "connected OAK device"

                self._error = None
                self._running = True
                self._reader = threading.Thread(
                    target=self._read_loop,
                    name="oak-depthai-reader",
                    daemon=True,
                )
                self._reader.start()
                logger.info(
                    "Started DepthAI camera %s using SDK %s",
                    self._device_id,
                    self._sdk_version,
                )
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

            try:
                message_group = output_queue.tryGet() if output_queue is not None else None
                if message_group is None:
                    time.sleep(0.005)
                    continue

                rgb_message = message_group["rgb"]
                depth_message = message_group["depth"]
                rgb = rgb_message.getCvFrame()
                depth = depth_message.getFrame()

                if rgb is None or depth is None or rgb.size == 0 or depth.size == 0:
                    continue

                rgb = np.ascontiguousarray(rgb)
                depth = np.ascontiguousarray(depth, dtype=np.uint16)

                if rgb.shape[1] != depth.shape[1] or rgb.shape[0] != depth.shape[0]:
                    raise OakCameraError(
                        "DepthAI returned RGB and depth frames with different dimensions. "
                        "Check StereoDepth depth alignment and output size."
                    )

                with self._condition:
                    self._last_rgb = rgb
                    self._last_depth = depth
                    self._last_frame_at = time.monotonic()
                    self._sequence += 1
                    self._error = None
                    self._condition.notify_all()
            except Exception as exc:
                with self._condition:
                    self._error = f"DepthAI frame capture failed: {exc}"
                    self._condition.notify_all()
                logger.exception("DepthAI frame reader failed")
                time.sleep(0.25)

    def get_frame_pair(
        self,
        timeout: float = 3.0,
        after_sequence: int | None = None,
    ) -> tuple[np.ndarray, np.ndarray, int]:
        self.start()
        deadline = time.monotonic() + timeout

        with self._condition:
            target_sequence = self._sequence if after_sequence is None else after_sequence
            while self._sequence <= target_sequence or self._last_rgb is None or self._last_depth is None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    detail = self._error or "No synchronized RGB/depth frame arrived before timeout."
                    raise OakCameraError(detail)
                self._condition.wait(timeout=min(remaining, 0.25))
                if not self._running:
                    raise OakCameraError(self._error or "DepthAI camera stopped.")

            age = time.monotonic() - self._last_frame_at
            if age > 2.0:
                raise OakCameraError(
                    f"The most recent OAK frame is stale ({age:.1f}s old). Check the camera connection."
                )

            return self._last_rgb.copy(), self._last_depth.copy(), self._sequence

    def status(self, probe: bool = True) -> dict[str, Any]:
        if probe:
            try:
                self.start()
            except OakCameraError:
                pass

        with self._lock:
            fresh = self._last_rgb is not None and (time.monotonic() - self._last_frame_at) <= 2.0
            available = self._running and fresh
            return {
                "available": available,
                "backend": "depthai",
                "device_id": self._device_id,
                "sdk_version": self._sdk_version,
                "rgb": available,
                "depth": available,
                "resolution": f"{self.width}x{self.height}",
                "fps": self.fps,
                "synchronized": True,
                "depth_aligned_to": "RGB / CAM_A",
                "error": None if available else self._error or "Waiting for the first synchronized RGB/depth frame.",
            }

    def stop(self) -> None:
        with self._condition:
            self._running = False
            self._condition.notify_all()
            reader = self._reader
            self._reader = None
            self._close_device_locked()

        if reader and reader.is_alive() and reader is not threading.current_thread():
            reader.join(timeout=2.0)

    def _close_device_locked(self) -> None:
        device = self._device
        self._device = None
        self._queue = None
        if device is not None:
            try:
                device.close()
            except Exception:
                logger.debug("Error while closing DepthAI device", exc_info=True)
