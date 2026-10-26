import React, { useState } from "react";
import { UserCheck, Shield, KeyRound, AlertCircle, FileText, CheckCircle2, Lock } from "lucide-react";

export const CandidatePage: React.FC = () => {
  const [candidateId, setCandidateId] = useState("CAND-2026-ALICE");
  const [pin, setPin] = useState("••••••");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setLoggedIn(true);
    }, 500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-indigo-600" />
          Candidate Observer Portal
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Authorized candidate observers can audit blockchain block proofs and Merkle digests under strict read-only observation mode.
        </p>
      </div>

      {loggedIn ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Candidate Observer Session Active
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              Welcome, <strong>Alice Rivera</strong>. You are authenticated as an official candidate representative for District D1.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs bg-slate-50/50">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Candidate Name:</span>
              <span className="font-bold text-slate-900">Alice Rivera</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Party Affiliation:</span>
              <span className="text-slate-800">Digital Democracy Party (DDP)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Registration Serial:</span>
              <span className="font-mono text-slate-800">DDP-2026-REG-8819</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Auditing Rights:</span>
              <span className="text-emerald-700 font-semibold">Block Hashes & Merkle Receipts</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Voter Choice Decryption:</span>
              <span className="text-slate-400 italic">Restricted (Multi-Key Secret Sharing)</span>
            </div>
          </div>

          <button
            onClick={() => setLoggedIn(false)}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            End Observer Session
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="rounded-lg bg-amber-50 p-3.5 text-amber-900 text-xs border border-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Simulated verification check. Default pre-filled credentials demonstrate candidate audit mode without exposing inner voter identities.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Candidate Registration Identifier
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                />
                <Shield className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hardware Observer Passkey / PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                />
                <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              {loading ? "Authenticating Candidate Observer..." : "Access Candidate Observer Dashboard"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
