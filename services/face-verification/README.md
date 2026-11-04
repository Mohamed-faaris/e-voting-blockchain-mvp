# Local face verification service

Optional local face enrollment and matching for the Civic Ledger booth prototype.

## Camera architecture

The OAK-D Lite is owned exclusively by **services/depthai-stream-server**. The face-verification service does not open a DepthAI device and does not create a second camera pipeline.

- The DepthAI Stream Server uses the working Luxonis DepthAI v2 pipeline and owns the USB device.
- RGB comes from `GET /streams/rgb.jpg`.
- Stereo depth comes from `GET /api/frame/depth.png`, a lossless 16-bit PNG containing depth in millimetres.
- StereoDepth aligns depth to RGB / CAM_A.
- The face service reads frames over loopback HTTP using `DEPTHAI_STREAM_SERVER_URL` (default `http://127.0.0.1:8090`).
- The existing Admin MJPEG route is retained as an adapter over the stream server's RGB JPEG endpoint.
- No UVC virtual camera, `/dev/video10`, Unix socket, or second DepthAI device owner is used.

The stream server's browser preview may colorize depth for visualization. Face verification uses the raw 16-bit depth endpoint, never the colorized preview.

## Start both services

Keep the OAK-D Lite connected to the same machine. Start the DepthAI device owner first:

~~~bash
cd services/depthai-stream-server
uv sync
uv run uvicorn server:app --host 127.0.0.1 --port 8090
~~~

Check its status and open its camera dashboard:

- Dashboard: http://127.0.0.1:8090/
- Status: http://127.0.0.1:8090/api/status
- Raw RGB JPEG: http://127.0.0.1:8090/streams/rgb.jpg
- Raw 16-bit depth PNG: http://127.0.0.1:8090/api/frame/depth.png

Then start face verification in a second terminal:

~~~bash
cd services/face-verification
uv sync
uv run python download_models.py
uv run uvicorn app:app --host 127.0.0.1 --port 8765
~~~

The face service binds to loopback only. To use a different stream-server address, set `DEPTHAI_STREAM_SERVER_URL` before starting it.

## Browser-side face bounding boxes

The Admin panel uses the existing `@vladmandic/face-api` dependency and Tiny Face Detector in the browser.

- The same JavaScript detector processes the selected webcam video or the raw OAK MJPEG image.
- A transparent canvas draws green face boxes and confidence percentages over the preview.
- Model weights are copied from the installed npm package into the Vite public directory before Admin dev/build starts.
- The Python face service sends unannotated OAK RGB frames. Face-box rendering is handled by browser JavaScript.
- Browser face detection is a visual overlay only. Python face matching and the stereo-depth heuristic are separate verification steps.

## Face verification

- OpenCV YuNet detects faces.
- OpenCV SFace creates the face embedding and compares it with the locally enrolled template.
- One face template is stored in SQLite under `~/.local/share/civic-ledger-face/` by default.
- Captured frames are processed in memory and are not retained.
- OAK enrollment and verification fetch RGB directly from the DepthAI Stream Server.
- When depth checking is requested, the face service fetches the aligned 16-bit depth PNG and evaluates the detected face region.
- Webcam mode uses the browser-provided base64 JPEG and does not have stereo depth.

The depth-based facial-shape check is a heuristic. It is not certified liveness detection and cannot guarantee rejection of photographs, videos, displays, masks, or other presentation attacks.

## Admin workflow

1. Start `services/depthai-stream-server`.
2. Confirm RGB and depth are ready at `http://127.0.0.1:8090/api/status`.
3. Start the local face-verification service.
4. Open Admin → Voter Check-in.
5. Enable optional face verification.
6. Select **OAK-D Lite (DepthAI direct RGB + stereo depth)** and start the camera.
7. Register the approved face, then select **Verify enrolled face** when required.

The browser receives the preview through the face service's existing MJPEG route. When enrollment or verification selects OAK, the face service fetches the latest RGB frame from the stream server. A depth frame is fetched only when `check_depth: true`.

For a standard webcam, the browser captures the image and sends its base64 JPEG to the face service. The webcam path does not connect to the OAK device.

## API

Face-verification service:

- `GET /` — local diagnostic dashboard.
- `GET /health` — face models, local enrollment and upstream OAK status.
- `GET /camera/oak/status` — separate RGB and stereo-depth availability.
- `GET /camera/oak/stream.mjpg` — MJPEG adapter over the stream-server RGB JPEG.
- `GET /camera/oak/snapshot` — latest RGB JPEG.
- `GET /face/status` — local enrollment status.
- `POST /face/enroll` — enroll from webcam image or OAK RGB frame.
- `POST /face/verify` — verify from webcam image or OAK RGB frame; optional raw depth check.
- `DELETE /face/enrollment` — delete the local face template.

DepthAI Stream Server:

- `GET /api/status` — device and per-stream availability.
- `POST /api/reconnect` — reconnect the OAK device.
- `GET /streams/rgb.jpg` — latest RGB JPEG frame.
- `GET /api/frame/depth.png` — latest aligned 16-bit depth frame, in millimetres.
- `GET /streams/{name}.jpg` — latest colorized/preview JPEG for supported streams.

Example OAK enrollment request:

~~~json
{
  "camera_source": "oak",
  "replace_existing": false
}
~~~

Example OAK verification request with the raw depth check enabled:

~~~json
{
  "camera_source": "oak",
  "check_depth": true
}
~~~

Webcam requests continue to use `image` with a base64-encoded JPEG and `camera_source: "webcam"`.

## Troubleshooting

Run these checks in order:

~~~bash
# 1. Verify the OAK device owner is producing frames.
curl -s http://127.0.0.1:8090/api/status | python -m json.tool

# 2. Verify the RGB stream returns a JPEG.
curl -f http://127.0.0.1:8090/streams/rgb.jpg -o /tmp/oak-rgb.jpg

# 3. Verify raw depth is a 16-bit PNG.
curl -f http://127.0.0.1:8090/api/frame/depth.png -o /tmp/oak-depth.png
file /tmp/oak-depth.png

# 4. Verify the face service can reach the stream server.
curl -s http://127.0.0.1:8765/camera/oak/status | python -m json.tool
~~~

Common causes:

- **RGB unavailable:** check the stream-server `rgb_available` field, USB data cable, USB port, device power and udev permissions.
- **Depth unavailable while RGB works:** inspect the stream-server `depth_available` field and the mono/stereo camera queues.
- **Face service reports upstream unavailable:** start the DepthAI Stream Server on port 8090 or set the correct `DEPTHAI_STREAM_SERVER_URL`.
- **Depth check fails:** verify the raw depth PNG is 16-bit, aligned to CAM_A, and contains valid non-zero measurements over the face region.
- **No face detected:** improve lighting, keep one face in frame and move closer to the camera.

Do not expose either local development service publicly. The stream server has no authentication or TLS. Keep the booth machine physically secured and protect the local OS account and face-template database.

This is a prototype feature, not certified biometric authentication or production election security.
