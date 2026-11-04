# DepthAI Stream Server

A standalone sample server for previewing OAK-D Lite camera and stereo streams. It is independent of the election application and does not import the face-verification service.

## Streams

| Stream | Description |
|---|---|
| RGB | OAK-D Lite color camera |
| Left / Right | Raw mono stereo sensors |
| Rectified left / right | Stereo-rectified mono frames |
| Disparity | Colorized stereo disparity |
| Depth | Colorized depth map aligned to RGB / CAM_A |

The pipeline uses DepthAI Python v2 (`depthai==2.32.0.0`): mono left/right feed `StereoDepth`; camera and stereo outputs are transferred to host queues. Each queue is polled by a single capture thread and the latest JPEG is shared among browser clients.

## Requirements

- OAK-D Lite connected over USB 3 where possible
- Ubuntu/Linux with working DepthAI USB permissions
- Python 3.10+ and `uv`

## Run

From the repository root:

```bash
cd services/depthai-stream-server
uv sync
uv run uvicorn server:app --host 127.0.0.1 --port 8090
```

Open <http://127.0.0.1:8090>.

For another device on a trusted LAN, bind to `0.0.0.0`. Do not expose this development server publicly; it has no authentication or TLS.

## HTTP endpoints

- `GET /` — browser dashboard
- `GET /api/status` — device and stream status
- `POST /api/reconnect` — reconnect after USB/device errors
- `GET /streams/{name}.jpg` — latest JPEG frame
- `GET /health` — basic process health

## Notes

- Depth values are millimetres; preview is clipped at 5,000 mm for visualization only.
- This simple sample uses JPEG polling, not a low-latency production video transport.
- Hardware testing was not possible in the authoring environment. Verify camera socket availability, USB permissions and device firmware on the target OAK-D Lite.
