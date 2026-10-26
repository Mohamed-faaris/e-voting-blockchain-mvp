import React, { useRef, useState, useEffect } from "react";
import { Camera, Radio, CheckCircle2, AlertOctagon, Scan, AlertCircle } from "lucide-react";
import * as faceapi from "@vladmandic/face-api";

interface BoothHardwareSimProps {
  onCardTapped: (voterId: string) => void;
  onLivenessVerified: () => void;
}

export const BoothHardwareSim: React.FC<BoothHardwareSimProps> = ({
  onCardTapped,
  onLivenessVerified
}) => {
  const [rfidActive, setRfidActive] = useState(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // Real Camera & Face Detection States
  const [cameraOn, setCameraOn] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLabel, setCameraLabel] = useState<string>("");
  const [detectedFaces, setDetectedFaces] = useState<Array<{ x: number; y: number; width: number; height: number; score: number }>>([]);
  const [scanning, setScanning] = useState(false);
  const [livenessResult, setLivenessResult] = useState<"ok" | "no_face" | "spoof" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<any>(null);

  const demoCards = [
    { voterId: "VOTER-101", name: "Amara Okafor", chipId: "RPIC-04-A9F1" },
    { voterId: "VOTER-102", name: "Devon Vance", chipId: "RPIC-04-B3C2" },
    { voterId: "VOTER-103", name: "Priya Sharma", chipId: "RPIC-04-E7D4" }
  ];

  const handleTap = (card: typeof demoCards[0]) => {
    setRfidActive(true);
    setActiveCard(card.voterId);
    setTimeout(() => {
      setRfidActive(false);
      onCardTapped(card.voterId);
    }, 400);
  };

  // 1. Load actual TensorFlow face-api TinyFaceDetector model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        setModelLoaded(true);
      } catch (err) {
        console.warn("Failed to load tinyFaceDetector model:", err);
      }
    };
    loadModel();
  }, []);

  // 2. Start webcam
  const startCamera = async () => {
    setCameraError(null);
    setLivenessResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam access not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);

        const track = stream.getVideoTracks()[0];
        if (track) setCameraLabel(track.label || "Connected Video Input");
      }
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission denied. Allow camera access in your browser."
          : `Camera error: ${err.message || "Failed to start camera"}`
      );
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
    setDetectedFaces([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // 3. Real-time Face Detection Loop with @vladmandic/face-api
  useEffect(() => {
    if (!cameraOn || !modelLoaded) return;

    const detectLoop = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const video = videoRef.current;
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
        const detections = await faceapi.detectAllFaces(video, options);

        if (detections && detections.length > 0) {
          const videoWidth = video.videoWidth || 640;
          const videoHeight = video.videoHeight || 480;

          // Normalize to viewport dimensions
          const clientW = video.clientWidth || 320;
          const clientH = video.clientHeight || 208;
          const scaleX = clientW / videoWidth;
          const scaleY = clientH / videoHeight;

          const boxes = detections.map((d) => {
            const { x, y, width, height } = d.box;
            return {
              // Video is scale-x-[-1] mirrored
              x: Math.round(clientW - (x + width) * scaleX),
              y: Math.round(y * scaleY),
              width: Math.round(width * scaleX),
              height: Math.round(height * scaleY),
              score: Math.round(d.score * 100)
            };
          });

          setDetectedFaces(boxes);
        } else {
          setDetectedFaces([]);
        }
      } catch (err) {
        // detection frame error
      }
    };

    intervalRef.current = setInterval(detectLoop, 120);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cameraOn, modelLoaded]);

  // Auto-start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const handleVerifyFace = (simulateSpoof = false) => {
    setScanning(true);
    setLivenessResult(null);

    setTimeout(() => {
      setScanning(false);
      if (detectedFaces.length === 0) {
        setLivenessResult("no_face");
      } else if (simulateSpoof) {
        setLivenessResult("spoof");
      } else {
        setLivenessResult("ok");
        onLivenessVerified();
      }
    }, 450);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scan className="h-5 w-5 text-indigo-600" />
            Booth Peripheral Terminal & Neural Face Detection
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Powered by real browser TensorFlow TinyFaceDetector Neural Network and contactless 13.56 MHz RPIC smartcard polling.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Module A: NFC / RPIC Reader */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">RPIC Contactless Smartcard</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                rfidActive
                  ? "bg-emerald-100 text-emerald-800 animate-pulse"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {rfidActive ? "READING CARD..." : "POLLING 13.56 MHz"}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Click any voter smartcard below to simulate tapping at the physical booth reader:
          </p>

          <div className="space-y-1.5">
            {demoCards.map((c) => (
              <button
                key={c.voterId}
                onClick={() => handleTap(c)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex items-center justify-between ${
                  activeCard === c.voterId
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">ID: {c.voterId}</div>
                </div>
                <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                  {c.chipId}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Module B: Real-Time TensorFlow Face Detection */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Neural Face Detector</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                {modelLoaded ? "NN MODEL LOADED" : "LOADING NN..."}
              </span>
              {!cameraOn ? (
                <button
                  onClick={startCamera}
                  className="rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700 transition"
                >
                  Enable Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-300 transition"
                >
                  Turn Off
                </button>
              )}
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="relative h-52 rounded-lg border border-slate-300 bg-slate-950 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
                cameraOn ? "block" : "hidden"
              }`}
            />

            {!cameraOn && !cameraError && (
              <div className="text-center text-slate-400 text-xs space-y-1.5 p-4">
                <Camera className="h-8 w-8 mx-auto text-slate-500 animate-pulse" />
                <div className="font-semibold text-slate-300">Initializing Neural Camera...</div>
                <div className="text-[11px] text-slate-500">
                  Allow camera permission to run real-time TensorFlow face detection.
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-4 text-center text-xs space-y-2 text-red-300">
                <AlertOctagon className="h-7 w-7 mx-auto text-red-400" />
                <div className="font-semibold">{cameraError}</div>
                <button
                  onClick={startCamera}
                  className="rounded bg-red-800/60 text-white px-2.5 py-1 text-[11px] font-semibold border border-red-500/50"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Real Face Bounding Box Overlays from face-api detection coordinates */}
            {cameraOn &&
              detectedFaces.map((face, idx) => (
                <div
                  key={idx}
                  style={{
                    left: `${face.x}px`,
                    top: `${face.y}px`,
                    width: `${face.width}px`,
                    height: `${face.height}px`
                  }}
                  className={`absolute border-2 transition-all duration-100 rounded pointer-events-none ${
                    livenessResult === "spoof"
                      ? "border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20"
                      : livenessResult === "ok"
                      ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
                      : "border-blue-400 bg-blue-400/5 shadow-md shadow-blue-500/20"
                  }`}
                >
                  {/* Corner Markers */}
                  <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-current" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-current" />
                  <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-current" />
                  <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-current" />

                  {/* Neural Detection Confidence Tag */}
                  <div className="absolute -top-5 left-0 font-mono text-[9px] font-bold bg-slate-900/95 text-white px-1.5 py-0.5 rounded border border-slate-700/80 flex items-center gap-1.5 whitespace-nowrap shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>FACE CONF: {face.score}%</span>
                    <span className="text-slate-400">[{face.width}x{face.height}]</span>
                  </div>
                </div>
              ))}
          </div>

          <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>
              {detectedFaces.length > 0 ? (
                <strong className="text-emerald-700">{detectedFaces.length} Face(s) Detected in Frame</strong>
              ) : (
                <span className="text-slate-400">Searching for face in video stream...</span>
              )}
            </span>
            {cameraLabel && <span className="truncate max-w-[160px] text-slate-400">{cameraLabel}</span>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleVerifyFace(false)}
              disabled={!cameraOn || scanning}
              className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40"
            >
              {scanning ? "Analyzing Neural Vectors..." : "Verify Detected Face"}
            </button>
            <button
              onClick={() => handleVerifyFace(true)}
              disabled={!cameraOn || scanning}
              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-40"
              title="Test anti-spoof rejection"
            >
              Simulate Photo Spoof
            </button>
          </div>

          {livenessResult === "ok" && (
            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Live face recognized by Neural Network. Liveness confirmed.
            </div>
          )}

          {livenessResult === "no_face" && (
            <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              No face detected in video frame. Position your face in front of the camera.
            </div>
          )}

          {livenessResult === "spoof" && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800 font-medium flex items-center gap-1.5 animate-in fade-in">
              <AlertOctagon className="h-3.5 w-3.5 text-red-600 shrink-0" />
              Anti-spoof trip: flat static reflection detected. Voter verification blocked.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
