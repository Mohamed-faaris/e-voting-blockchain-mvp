# DepthAI Stream Server

Standalone OAK-D Lite stream service using the working Luxonis DepthAI Python v2 pipeline. It is the **only process that opens the OAK USB device**; other local services consume its HTTP endpoints.

## Streams

| Stream | Description |
|---|---|
| RGB | OAK-D Lite color camera |
| Left / Right | Raw mono stereo sensors |
| Rectified left / right | Stereo-rectified mono frames |
| Disparity | Colorized stereo disparity |
| Depth | Colorized depth preview aligned to RGB / CAM_A |

The pipeline uses DepthAI Python v2 (`depthai==2.32.0.0`): mono left/right feed `StereoDepth`; RGB and stereo outputs are transferred to host queues. A single capture thread polls the queues and caches the latest frames for browser clients.

## Requirements

- OAK-D Lite connected over USB 3 where possible
- Ubuntu/Linux with working DepthAI USB permissions
- Python 3.10+ and `uv`

## Run

From the repository root:

~~~bash
cd services/depthai-stream-server
uv sync
uv run uvicorn server:app --host 127.0.0.1 --port 8090
~~~

Open http://127.0.0.1:8090/.

## HTTP endpoints

- `GET /` — browser dashboard
- `GET /api/status` — device and per-stream status, including separate `rgb_available` and `depth_available`
- `POST /api/reconnect` — reconnect after USB/device errors
- `GET /streams/{name}.jpg` — latest JPEG preview for a supported stream
- `GET /api/frame/depth.png` — latest **raw 16-bit depth PNG**, values in millimetres, aligned to CAM_A
- `GET /health` — process and stream availability

The colorized `/streams/depth.jpg` endpoint is for visualization only. Do not use it for measurement or face-depth checks. Consumers that need metric depth must use `/api/frame/depth.png`.

## Integration with face verification

The face-verification service does not create a second DepthAI device or import the camera implementation. It reads:

- RGB from `/streams/rgb.jpg`
- Raw aligned depth from `/api/frame/depth.png`
- Status from `/api/status`

The face service defaults to `http://127.0.0.1:8090` and accepts an override through `DEPTHAI_STREAM_SERVER_URL`. Start this server before the face-verification service.

## Notes

- Raw depth values are millimetres; the browser preview is clipped at 5,000 mm for visualization only.
- The camera streams are polled independently; RGB and depth are not hardware timestamp-synchronized by this sample service.
- This simple sample uses JPEG polling, not a low-latency production video transport.
- Do not expose this development server publicly; it has no authentication or TLS.
