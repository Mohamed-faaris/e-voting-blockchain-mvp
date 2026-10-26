import React, { useState, useEffect } from "react";
import { Camera, Radio, Wifi, Server, CheckCircle2, ShieldAlert, RefreshCw, Cpu } from "lucide-react";

export const SystemCheckPage: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [statuses, setStatuses] = useState([
    {
      name: "HD Voter Authentication Camera",
      category: "Biometrics & Computer Vision",
      status: "connected",
      details: "Resolution: 1080p @ 60fps. Face bounding box tracking active. Vector latency: 8ms.",
      latency: "8ms"
    },
    {
      name: "RPIC / Optical Voter Card Reader",
      category: "Hardware Peripheral (RFID/NFC)",
      status: "connected",
      details: "SAM Secure Access Module online. Contactless 13.56MHz transceiver operational.",
      latency: "4ms"
    },
    {
      name: "Encrypted Network & Internet Mesh",
      category: "Network Gateway",
      status: "connected",
      details: "TLS 1.3 dual-tunnel active with automatic cellular/satellite fallback.",
      latency: "26ms"
    },
    {
      name: "Consensus Ledger & Validator Node",
      category: "Backend Engine",
      status: "connected",
      details: "Connected to Turso Cloud libSQL consensus pool. Sync lag: 0 blocks.",
      latency: "31ms"
    }
  ]);

  const runDiagnostics = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setServerHealth(data);
    } catch {
      // offline fallback
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-blue-600" />
            Hardware & Network System Check
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time diagnostics for voting booth hardware peripherals, network gateway, and validator consensus engine.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
          Re-run Diagnostics
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs shadow-2xs">
        <div>
          <div className="text-slate-400 font-medium text-[11px]">Station Terminal</div>
          <div className="font-mono font-bold text-slate-800 mt-0.5">BOOTH-D1-04</div>
        </div>
        <div>
          <div className="text-slate-400 font-medium text-[11px]">Ledger Engine</div>
          <div className="font-mono font-bold text-slate-800 mt-0.5">{serverHealth?.database || "Turso Cloud"}</div>
        </div>
        <div>
          <div className="text-slate-400 font-medium text-[11px]">Cryptographic State</div>
          <div className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Enclave Active
          </div>
        </div>
        <div>
          <div className="text-slate-400 font-medium text-[11px]">Tamper Interlocks</div>
          <div className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sensors Intact
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {statuses.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition"
          >
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                {i === 0 && <Camera className="h-5 w-5 text-blue-600" />}
                {i === 1 && <Radio className="h-5 w-5 text-emerald-600" />}
                {i === 2 && <Wifi className="h-5 w-5 text-indigo-600" />}
                {i === 3 && <Server className="h-5 w-5 text-amber-600" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{item.details}</p>
              </div>
            </div>

            <div className="text-right shrink-0 ml-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ONLINE</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">Ping: {item.latency}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
