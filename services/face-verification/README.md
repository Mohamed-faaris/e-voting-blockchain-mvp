# Local face verification service

Optional local face enrollment and matching for the Civic Ledger booth prototype.

## Camera architecture

The OAK-D Lite is controlled **directly by the Python service through the Luxonis DepthAI SDK**.

- RGB: OAK-D Lite CAM_A (640×480).
- Stereo: left/right mono sensors feed StereoDepth.
- Depth: aligned to the RGB camera and emitted in millimetres.
- Synchronization: DepthAI Sync node groups RGB and depth frames by device timestamps.
- The Python service owns the camera connection and exposes the stream over its existing FastAPI endpoints.

There is no OAK bridge process, UVC virtual camera, /dev/video10 dependency, or Unix depth socket.

The regular webcam remains a separate browser-camera option. Selecting OAK-D Lite does not use browser camera enumeration or getUserMedia().

## Face verification

- OpenCV YuNet detects faces.
- OpenCV SFace creates the face embedding and compares it with the locally enrolled template.
- One face template is stored in SQLite under ~/.local/share/civic-ledger-face/ by default.
- Captured frames are processed in memory and are not retained.
- OAK verification uses the RGB frame and its synchronized, RGB-aligned stereo-depth frame from the same DepthAI message group.
- Face verification remains optional; the existing non-biometric booth flow remains available.

This is a prototype feature, not certified biometric authentication or production election security. Stereo facial-shape checks are heuristics and do not guarantee rejection of photographs, videos, displays or masks.

## Requirements

- Ubuntu/Linux with USB access to an OAK-D Lite.
- Python 3.10+.
- uv for dependency and environment management.
- USB data cable and the Luxonis Linux USB permissions/udev configuration.

### DepthAI version

The project pins depthai==2.32.0.0 and uses the DepthAI v2 pipeline API for the OAK-D Lite (RVC2).

This is a deliberate compatibility choice: a Luxonis issue report from August 2026 documents an OAK-D Lite stereo-camera failure with DepthAI 3.8 and reports the same device working with 2.32.0.0. This report is a device/version-specific compatibility signal, not a guarantee for every OAK-D Lite revision. See [Luxonis issue #1252](https://github.com/luxonis/depthai/issues/1252) and the [DepthAI v2 Python repository](https://github.com/luxonis/depthai-python).

Do not upgrade this service to DepthAI v3 without repeating the RGB + stereo test on the actual OAK-D Lite.

## Install and run

From the repository root:

~~~bash
cd services/face-verification
uv sync
uv run python download_models.py
uv run uvicorn app:app --host 127.0.0.1 --port 8765
~~~

The service binds to loopback only. Model files are downloaded into models/ and are intentionally not committed. The default local data directory is owner-only (0700) and the SQLite database is owner-only (0600) where supported.

Connect the OAK-D Lite directly to the booth machine before starting the OAK camera. On Linux, make sure the current user has USB access according to the [Luxonis installation instructions](https://docs.luxonis.com/software/depthai/).

## Admin workflow

1. Start the local FastAPI face service.
2. Open Admin → Voter Check-in.
3. Enable optional face verification.
4. Select **OAK-D Lite (DepthAI direct RGB + stereo depth)**.
5. Select **Start camera**. The Python service discovers the OAK device, starts the RGB/stereo pipeline and displays its MJPEG stream in the Admin panel.
6. Register the administrator-approved face, then use **Verify enrolled face** when required.
7. For OAK mode, the browser sends only camera_source: "oak". The Python service captures a synchronized RGB/depth pair directly from DepthAI; the browser does not capture the OAK image.

For a standard webcam, the browser still captures the image and sends its base64 JPEG to the service. Webcam mode does not perform stereo-depth checks.

If the OAK device cannot be opened, the service reports the DepthAI error and the booth offers its existing explicit non-biometric fallback.

## API

- GET / — local diagnostic dashboard.
- GET /health — service, model and direct DepthAI camera status.
- GET /camera/oak/status — device identity, SDK version, RGB/depth availability, alignment and synchronization status.
- GET /camera/oak/stream.mjpg — annotated live RGB stream captured directly from DepthAI.
- GET /camera/oak/snapshot — one annotated OAK RGB frame.
- GET /face/status — local enrollment status.
- POST /face/enroll — enroll from a webcam base64 image or direct OAK capture.
- POST /face/verify — verify from a webcam base64 image or direct OAK capture.
- DELETE /face/enrollment — delete the local face template.

Example OAK enrollment request:

~~~json
{
  "camera_source": "oak",
  "replace_existing": false
}
~~~

Example OAK verification request:

~~~json
{
  "camera_source": "oak",
  "check_depth": true
}
~~~

Webcam requests continue to use image with a base64-encoded JPEG and camera_source: "webcam".

## Troubleshooting

Check the camera independently from the face-recognition models:

~~~bash
uv run python -c "import depthai as dai; print('DepthAI', dai.__version__); print(dai.Device.getAllAvailableDevices())"
curl -s http://127.0.0.1:8765/camera/oak/status | python -m json.tool
~~~

The status endpoint waits for a synchronized RGB/depth frame. Check the returned error field if ready is false.

Common causes:

- **No device detected:** check USB data cable, USB port, device power and Linux udev permissions.
- **Permission denied:** configure the Luxonis USB udev rules and reconnect the camera.
- **Pipeline or firmware failure:** retain the pinned DepthAI 2.32.0.0 version and capture the Python error plus device crash dump.
- **RGB works but depth does not:** verify the OAK stereo cameras are visible and that the device is an OAK-D Lite with stereo sensors.
- **Depth does not align:** this pipeline configures StereoDepth alignment to CAM_A and emits the depth map at the RGB output size. The backend checks that RGB/depth dimensions match before using them.
- **No face detected:** improve lighting, keep one face in frame and move closer to the camera.

Do not use this prototype as the only safeguard for a real election. Keep the booth machine physically secured and protect the local OS account and face-template database.
