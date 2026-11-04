# Local face verification service

Optional local-only face enrollment and matching for the Civic Ledger booth prototype.

## What it does

- Uses OpenCV YuNet for face detection and OpenCV SFace for face embeddings/matching.
- Allows one enrolled face template on the booth machine.
- Stores only one enrolled face embedding in a local SQLite file under `~/.local/share/civic-ledger-face/`; camera frames are processed in memory and are not retained.
- Can read the OAK-D Lite depth bridge at `/tmp/oak_depth.sock`.
- Exposes a local HTTP API on `127.0.0.1:8765`.

This is a prototype feature, not certified biometric authentication or a production election security control. The depth spread check is a basic heuristic and cannot guarantee rejection of all photographs, videos, displays or masks.

## Requirements

- Python 3.10+
- OAK-D Lite bridge running for stereo depth checks.
- Existing bridge outputs:
  - RGB camera: `/dev/video10` (OAK RGB Bridge)
  - Depth socket: `/tmp/oak_depth.sock`
  - Depth protocol: Unix `AF_UNIX/SOCK_STREAM`; each connection receives a 12-byte little-endian `<III` header (width, height, payload byte count), then raw little-endian `uint16` depth in millimetres.

## Install and run

From the repository root:

```bash
cd services/face-verification
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_models.py
uvicorn app:app --host 127.0.0.1 --port 8765
```

The service binds to loopback only. Keep it on the booth machine. The model downloader fetches the OpenCV Zoo YuNet and SFace ONNX models into `models/`; model files are intentionally not committed. The default local data directory is owner-only (`0700`) and the SQLite file is owner-only (`0600`) where supported.

## Frontend workflow

1. Open Admin → Voter Check-in.
2. Select either the default webcam or the OAK RGB camera from the browser camera list.
3. Use the admin face registration action to enroll/replace the booth's single face template.
4. Face verification is optional. If enabled, capture a frame and call the local verification API. Only the single enrolled face template is accepted.
5. With OAK selected, request stereo depth verification. With a regular webcam, depth checks are unavailable.
6. If the local service, camera or depth bridge is unavailable, the existing voter check-in remains available. A positive face mismatch is shown as a mismatch; it is not silently treated as a match.

## API

- `GET /health` — service, model, enrollment and bridge status.
- `GET /face/status` — enrollment status.
- `POST /face/enroll` — JSON: `{ "image": "<base64 JPEG>", "camera_source": "webcam|oak", "replace_existing": false }`.
- `POST /face/verify` — JSON: `{ "image": "<base64 JPEG>", "camera_source": "webcam|oak", "check_depth": true|false }`.
- `DELETE /face/enrollment` — delete the local face template.

The service stores the embedding in a local SQLite file under `~/.local/share/civic-ledger-face/face_templates.sqlite3` by default; camera frames are not retained. The Admin booth provides the registration, replacement and deletion controls. The service binds to loopback through the Vite proxy. Restrict physical access to the booth and protect the host OS account and local data directory.
