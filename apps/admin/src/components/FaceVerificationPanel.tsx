import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Fingerprint, RefreshCw, ShieldAlert, Trash2, UserRound, Video } from "lucide-react";

type CameraSource = "webcam" | "oak";
type CameraDevice = { deviceId: string; label: string; source: CameraSource };
type FaceStatus = { registered: boolean; storage: string; match_threshold: number };
type FaceResult = {
  success: boolean;
  matched: boolean;
  similarity: number;
  threshold: number;
  depth: null | { passed: boolean; unavailable?: boolean; reason: string; valid_ratio?: number; median_depth_mm?: number; depth_spread_mm?: number; nose_relief_mm?: number };
  message: string;
  note: string;
};

const API = "/face-api";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || `Face service request failed (${response.status})`);
  }
  return payload as T;
}

export function FaceVerificationPanel({ onVerified, onEnabledChange, onFallback, fallbackAvailable = false }: { onVerified?: () => void; onEnabledChange?: (enabled: boolean) => void; onFallback?: () => void; fallbackAvailable?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [cameraSource, setCameraSource] = useState<CameraSource>("webcam");
  const [cameraReady, setCameraReady] = useState(false);
  const [oakPreviewActive, setOakPreviewActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [notice, setNotice] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOakPreviewActive(false);
    setCameraReady(false);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API}/face/status`);
      const data = await parseResponse<FaceStatus>(response);
      setStatus(data);
      setServiceError("");
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Python face service is unavailable.");
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    try {
      let list = await navigator.mediaDevices.enumerateDevices();
      if (list.some((device) => device.kind === "videoinput") && list.filter((device) => device.kind === "videoinput").every((device) => !device.label)) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        permissionStream.getTracks().forEach((track) => track.stop());
        list = await navigator.mediaDevices.enumerateDevices();
      }
      const cameras = list.filter((device) => device.kind === "videoinput").map((device, index) => {
        const label = device.label || `Camera ${index + 1}`;
        return { deviceId: device.deviceId, label, source: "webcam" as const };
      });
      setDevices(cameras);
      const preferred = cameras[0];
      if (preferred) setDeviceId((current) => current || preferred.deviceId);
      setCameraError("");
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Could not list camera devices.");
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    try {
      if (cameraSource === "oak") {
        const response = await fetch(`${API}/camera/oak/status`, { cache: "no-store" });
        const data = await parseResponse<{ ready: boolean; rgb: { error?: string | null }; depth: { error?: string | null } }>(response);
        if (!data.ready) {
          throw new Error(data.rgb.error || data.depth.error || "DepthAI could not start a synchronized OAK RGB/depth stream.");
        }
        setOakPreviewActive(true);
        setCameraReady(true);
        return;
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } } : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        void refreshCameras();
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Could not start selected camera.");
    }
  }, [cameraSource, deviceId, refreshCameras, stopCamera]);

  useEffect(() => {
    void refreshStatus();
    return () => stopCamera();
  }, [refreshStatus, stopCamera]);

  useEffect(() => {
    if (enabled) void refreshCameras();
  }, [enabled, refreshCameras]);

  const capturePayload = () => {
    if (cameraSource === "oak") {
      if (!cameraReady || !oakPreviewActive) throw new Error("Start the OAK-D Lite DepthAI stream first.");
      // The Python service captures the OAK RGB/depth pair directly from DepthAI.
      return { camera_source: "oak" as const };
    }

    const video = videoRef.current;
    if (!video || !cameraReady || video.videoWidth === 0) {
      throw new Error("Start the selected webcam before capturing a face.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare camera frame.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { image: canvas.toDataURL("image/jpeg", 0.9).split(",", 2)[1], camera_source: "webcam" as const };
  };

  const enroll = async () => {
    setBusy(true);
    setServiceError("");
    setNotice("");
    setResult(null);
    try {
      const response = await fetch(`${API}/face/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...capturePayload(), replace_existing: false })
      });
      const data = await parseResponse<{ message: string }>(response);
      setNotice(data.message);
      await refreshStatus();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Face registration failed.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setServiceError("");
    setNotice("");
    setResult(null);
    try {
      const response = await fetch(`${API}/face/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...capturePayload(), check_depth: cameraSource === "oak" })
      });
      const data = await parseResponse<FaceResult>(response);
      setResult(data);
      if (data.matched && (data.depth === null || data.depth.passed)) onVerified?.();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Face verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const replaceEnrollment = async () => {
    if (!window.confirm("Replace the face template currently stored on this booth?")) return;
    setBusy(true);
    setServiceError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/face/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...capturePayload(), replace_existing: true })
      });
      const data = await parseResponse<{ message: string }>(response);
      setNotice(data.message);
      await refreshStatus();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Could not replace face registration.");
    } finally {
      setBusy(false);
    }
  };

  const deleteEnrollment = async () => {
    if (!window.confirm("Permanently delete the locally stored face template?")) return;
    setBusy(true);
    setServiceError("");
    try {
      await parseResponse(await fetch(`${API}/face/enrollment`, { method: "DELETE" }));
      setStatus({ registered: false, storage: "local SQLite", match_threshold: status?.match_threshold ?? 0.363 });
      setNotice("Local face template deleted.");
      setResult(null);
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Could not delete face registration.");
    } finally {
      setBusy(false);
    }
  };

  const selectedCamera = devices.find((device) => device.deviceId === deviceId);
  const sourceCameraAvailable = cameraSource === "oak" || devices.some((device) => device.source === "webcam");
  const showCameraControls = enabled || status?.registered === false;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Fingerprint className="h-4 w-4 text-indigo-600" /> Optional Face Verification
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Admin-only enrollment and local Python face matching, with optional OAK-D Lite stereo-depth screening.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(event) => { const next = event.target.checked; setEnabled(next); onEnabledChange?.(next); setResult(null); }} />
          Enable face check
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs">
        <span className="flex items-center gap-2 text-slate-600"><ShieldAlert size={15} /> Enrollment status</span>
        <strong className={status?.registered ? "text-emerald-700" : "text-amber-700"}>
          {status === null ? "Checking service…" : status.registered ? "One face enrolled locally" : "No face enrolled"}
        </strong>
      </div>

      {showCameraControls ? (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <label className="block space-y-1 text-xs font-semibold text-slate-700">
                Camera type
                <select className="w-full rounded-lg border border-slate-300 bg-white p-2.5" value={cameraSource} onChange={(event) => {
                  const source = event.target.value as CameraSource;
                  stopCamera();
                  setCameraSource(source);
                  setResult(null);
                }}>
                  <option value="webcam">Default webcam / USB camera</option>
                  <option value="oak">OAK-D Lite (DepthAI direct RGB + stereo depth)</option>
                </select>
              </label>
              {cameraSource === "webcam" && <label className="block space-y-1 text-xs font-semibold text-slate-700">
                Video device
                <select className="w-full rounded-lg border border-slate-300 bg-white p-2.5" value={deviceId} onChange={(event) => {
                  const next = devices.find((device) => device.deviceId === event.target.value);
                  setDeviceId(event.target.value);
                  setResult(null);
                }}>
                  {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
                </select>
              </label>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void refreshCameras()} className="ev-button secondary flex-1"><RefreshCw size={14} /> Refresh</button>
                <button type="button" disabled={!sourceCameraAvailable} onClick={() => void startCamera()} className="ev-button flex-1 disabled:opacity-50"><Video size={14} /> Start camera</button>
              </div>
              <p className="text-[11px] text-slate-500">
                {cameraSource === "oak" ? "OAK-D Lite selected. The Python service connects directly through the DepthAI SDK and captures synchronized RGB + aligned stereo depth. No browser camera device or bridge is used." : "Standard webcam selected. Face matching works, but stereo-depth checks are unavailable."}
              </p>
              {!sourceCameraAvailable && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  No {cameraSource === "oak" ? "OAK-D Lite RGB bridge" : "webcam"} device is available. Select an available camera or connect the device before starting.
                </p>
              )}
            </div>
            <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-950">
              <video ref={videoRef} muted playsInline className="h-full max-h-64 w-full object-cover" />
              {cameraSource === "oak" ? (
                oakPreviewActive && <img src={`${API}/camera/oak/stream.mjpg`} alt="OAK-D Lite DepthAI RGB stream" className="h-full max-h-64 w-full object-contain" />
              ) : (
                <video ref={videoRef} muted playsInline className="h-full max-h-64 w-full object-cover" />
              )}
              {!cameraReady && <div className="absolute px-4 text-center text-xs text-slate-300">Start a camera to preview the registration/verification frame.</div>}
              {cameraReady && <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] text-white">{cameraSource === "oak" ? "OAK-D Lite · DepthAI" : selectedCamera?.label ?? "Webcam active"}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!status?.registered ? (
              <button type="button" disabled={busy || !cameraReady} onClick={() => void enroll()} className="ev-button flex-1 disabled:opacity-50">
                <UserRound size={15} /> {busy ? "Registering…" : "Register my face"}
              </button>
            ) : (
              <>
                <button type="button" disabled={busy || !cameraReady} onClick={() => void verify()} className="ev-button flex-1 disabled:opacity-50">
                  <Fingerprint size={15} /> {busy ? "Checking…" : "Verify enrolled face"}
                </button>
                <button type="button" disabled={busy || !cameraReady} onClick={() => void replaceEnrollment()} className="ev-button secondary disabled:opacity-50">Replace face</button>
                <button type="button" disabled={busy} onClick={() => void deleteEnrollment()} className="ev-button secondary disabled:opacity-50"><Trash2 size={14} /> Delete</button>
              </>
            )}
          </div>

          {result && (
            <div className={result.matched && (result.depth === null || result.depth.passed) ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1" : "rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1"}>
              <strong className="flex items-center gap-2"><CheckCircle2 size={15} /> {result.matched ? "Enrolled face matched" : "Face does not match the enrolled template"}</strong>
              <div>Similarity: {(result.similarity * 100).toFixed(1)}% · Match threshold: {(result.threshold * 100).toFixed(1)}%</div>
              {result.depth && <div>Depth check: {result.depth.passed ? "Passed" : "Not passed"} — {result.depth.reason}</div>}
              {result.depth?.depth_spread_mm !== undefined && <div>Depth spread: {result.depth.depth_spread_mm} mm · Valid depth: {((result.depth.valid_ratio ?? 0) * 100).toFixed(0)}%</div>}
              {result.depth?.nose_relief_mm !== undefined && <div>Nose-to-cheek depth relief: {result.depth.nose_relief_mm} mm</div>}
              <p>{result.note}</p>
            </div>
          )}
          {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p>}
          {cameraError && <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{cameraError}</p>}
          {serviceError && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{serviceError}</p>}
          {enabled && (serviceError || cameraError || (status !== null && !status.registered) || result?.depth?.unavailable) && (
            <button
              type="button"
              className="ev-button secondary w-full"
              onClick={() => {
                setEnabled(false);
                onEnabledChange?.(false);
                setResult(null);
                stopCamera();
                onFallback?.();
              }}
            >
              Continue without face verification
            </button>
          )}
        </>
      ) : (
        <>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Face verification is disabled. The existing smartcard and voter check-in flow remains available without biometric verification.
          </p>
          {fallbackAvailable && (
            <button
              type="button"
              className="ev-button secondary w-full"
              onClick={() => onFallback?.()}
            >
              Continue this smartcard check-in without face verification
            </button>
          )}
        </>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        Privacy: the Python service stores one face embedding locally; it does not save captured camera frames. This prototype's depth-spread test is only a heuristic and is not certified liveness detection. If the service or selected camera is unavailable, use the existing non-biometric check-in flow.
      </p>
    </section>
  );
}
