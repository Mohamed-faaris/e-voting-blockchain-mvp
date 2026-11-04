# Local face verification service

Optional local-only face enrollment and matching for the Civic Ledger booth prototype.

## What it does

- Uses OpenCV YuNet for face detection and OpenCV SFace for face embeddings/matching.
- Allows one enrolled face template on the booth machine.
- Stores only one enrolled face embedding in a local SQLite file under `~/.local/share/civic-ledger-face/`; camera frames are processed in memory and are not retained.
- Reads OAK RGB frames from the bridge virtual camera (default `/dev/video10`) and stereo depth from `/tmp/oak_depth.sock`.
- Provides a Python-generated MJPEG preview with YuNet face bounding boxes and SFace enrolled/unknown labels.
- Exposes a local HTTP API on `127.0.0.1:8765`.

This is a prototype feature, not certified biometric authentication or a production election security control. The depth spread check is a basic heuristic and cannot guarantee rejection of all photographs, videos, displays or masks.

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) for dependency and environment management.
- OAK-D Lite bridge running for stereo depth checks.
- Existing bridge outputs:
  - RGB camera: `/dev/video10` (OAK RGB Bridge; configurable with `OAK_RGB_DEVICE`)
  - Depth socket: `/tmp/oak_depth.sock`
  - Depth protocol: Unix `AF_UNIX/SOCK_STREAM`; each connection receives a 12-byte little-endian `<III` header (width, height, payload byte count), then raw little-endian `uint16` depth in millimetres.

## Install and run

From the repository root:

```bash
cd services/face-verification
uv sync
uv run python download_models.py
uv run uvicorn app:app --host 127.0.0.1 --port 8765
```

The service binds to loopback only. Keep it on the booth machine. Dependencies are declared in `pyproject.toml`; run `uv sync` to create/update `.venv` and generate `uv.lock`. Commit `uv.lock` so booth installations use a reproducible dependency resolution. Run commands through `uv run` rather than activating the environment manually. The model downloader fetches the OpenCV Zoo YuNet and SFace ONNX models into `models/`; model files are intentionally not committed. The default local data directory is owner-only (`0700`) and the SQLite file is owner-only (`0600`) where supported.

## Frontend workflow

1. Start the local Python service and the existing OAK-D Lite RGB/depth bridge when OAK mode is required.
2. Open Admin → Voter Check-in. Face enrollment and controls are available only in this Admin booth interface.
3. Enable face verification to open the camera controls, then choose the default webcam or OAK-D Lite RGB bridge.
4. Register the single administrator-approved face template. The service stores only its embedding in local SQLite; it does not retain captured frames. Admins can replace or delete the enrollment.
5. Face verification is optional and disabled by default. When enabled, a smartcard tap remains pending until the enrolled face matches. OAK-D Lite additionally requires the stereo-depth heuristic to pass; a standard webcam performs face matching without depth.
6. The selected camera source must have a matching browser video device. The UI prevents starting an OAK depth check with a missing OAK RGB device, avoiding a webcam RGB frame being compared against unrelated OAK depth.
7. If the Python service, selected camera, enrollment or depth bridge is unavailable, the booth offers an explicit fallback to the existing non-biometric check-in. A face mismatch or a valid depth frame that fails the depth heuristic does not automatically expose that fallback.
8. Disabling face verification does not silently authenticate a smartcard that is already pending; the operator must use the explicit fallback action to continue that check-in.

## API

- `GET /health` — service, model, enrollment and configured bridge paths.
- `GET /camera/oak/status` — actively probes RGB capture and reads a depth frame; returns separate RGB/depth diagnostics.
- `GET /camera/oak/stream.mjpg` — live Python-annotated MJPEG stream with face boxes and enrolled/unknown labels.
- `GET /camera/oak/snapshot` — one annotated OAK RGB frame as JPEG.
- `GET /face/status` — enrollment status.
- `POST /face/enroll` — JSON: `{ "image": "<base64 JPEG>", "camera_source": "webcam|oak", "replace_existing": false }`.
- `POST /face/verify` — JSON: `{ "image": "<base64 JPEG>", "camera_source": "webcam|oak", "check_depth": true|false }`.
- `DELETE /face/enrollment` — delete the local face template.

The service stores the embedding in a local SQLite file under `~/.local/share/civic-ledger-face/face_templates.sqlite3` by default; camera frames are not retained. The Admin booth provides the registration, replacement and deletion controls. The service binds to loopback through the Vite proxy. Restrict physical access to the booth and protect the host OS account and local data directory.


## OAK bridge diagnostics and Python preview

The FastAPI service now owns OAK RGB capture through OpenCV/V4L2. It does not depend on the browser's camera-device labels for the Python preview. Configure the actual virtual camera path if it differs:

```bash
OAK_RGB_DEVICE=/dev/video10 OAK_DEPTH_SOCKET=/tmp/oak_depth.sock \
  uv run uvicorn app:app --host 127.0.0.1 --port 8765
```

Check the bridge from the booth machine:

```bash
curl -s http://127.0.0.1:8765/camera/oak/status | python -m json.tool
ls -l /dev/video10 /tmp/oak_depth.sock
v4l2-ctl --list-devices
```

Open the Python-annotated live stream at `http://127.0.0.1:8765/camera/oak/stream.mjpg`. YuNet draws a bounding box around every detected face; when a local template exists, SFace labels each face `ENROLLED` or `UNKNOWN` with its similarity score. The snapshot endpoint returns one annotated JPEG frame. These are diagnostic overlays, not liveness proof or a security boundary. Keep the service bound to loopback.
