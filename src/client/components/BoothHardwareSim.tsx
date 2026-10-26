import React, { useState } from "react";
import { Radio, Camera, CheckCircle2, AlertTriangle, RefreshCw, Smartphone, Scan } from "lucide-react";

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
  const [cameraActive, setCameraActive] = useState(false);
  const [livenessScanning, setLivenessScanning] = useState(false);
  const [livenessResult, setLivenessResult] = useState<"passed" | "spoof_detected" | null>(null);

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
    }, 450);
  };

  const handleScanLiveness = (simulateSpoof = false) => {
    setLivenessScanning(true);
    setLivenessResult(null);
    setTimeout(() => {
      setLivenessScanning(false);
      if (simulateSpoof) {
        setLivenessResult("spoof_detected");
      } else {
        setLivenessResult("passed");
        onLivenessVerified();
      }
    }, 700);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Scan className="h-5 w-5 text-indigo-600" />
          Interactive Hardware Peripheral Simulation Terminal
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Test hardware-level NFC voter card tapping and biometric liveness verification gates directly in your browser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module A: NFC / RPIC Reader */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">RPIC NFC Card Reader</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                rfidActive
                  ? "bg-emerald-100 text-emerald-800 animate-pulse"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {rfidActive ? "READING CHIP..." : "POLLING (13.56 MHz)"}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Click a certified voter card below to simulate contactless ISO 14443 Type A NFC transmission:
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

        {/* Module B: Biometric Liveness Scanner */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Biometric Liveness Gate</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-mono font-semibold">
              IR 3D DEPTH
            </span>
          </div>

          <div className="relative h-28 rounded-lg border border-slate-300 bg-slate-900 flex flex-col items-center justify-center text-slate-400 overflow-hidden">
            <div className="absolute inset-0 bg-radial from-blue-500/10 to-transparent pointer-events-none" />
            <Camera className={`h-8 w-8 text-slate-500 ${livenessScanning ? "animate-pulse text-blue-400" : ""}`} />
            <div className="text-[10px] font-mono mt-1 text-slate-300">
              {livenessScanning ? "ANALYZING MICRO-BLINK & DEPTH VECTORS..." : "READY FOR BIOMETRIC SCAN"}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleScanLiveness(false)}
              disabled={livenessScanning}
              className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              Verify Live Face
            </button>
            <button
              onClick={() => handleScanLiveness(true)}
              disabled={livenessScanning}
              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
              title="Test anti-spoofing rejection with a flat photo"
            >
              Spoof Photo
            </button>
          </div>

          {livenessResult === "passed" && (
            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Liveness confirmed: 3D parallax verified. Hardware interlock opened.
            </div>
          )}

          {livenessResult === "spoof_detected" && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800 font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
              Spoof attack intercepted: static depth reflection detected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
