import React, { useState } from "react";
import { UserCheck, Shield, KeyRound, X, AlertCircle } from "lucide-react";

interface CandidateLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateLoginModal: React.FC<CandidateLoginModalProps> = ({ isOpen, onClose }) => {
  const [candidateId, setCandidateId] = useState("CAND-2026-ALICE");
  const [pin, setPin] = useState("••••••");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setLoggedIn(true);
    }, 600);
  };

  const handleReset = () => {
    setLoggedIn(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Candidate Portal</h3>
              <p className="text-xs text-slate-500">Observer & audit credential verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loggedIn ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Shield className="h-4 w-4" />
                  Candidate Observer Session Active
                </div>
                <p className="text-xs mt-1 text-emerald-700">
                  Welcome, Alice Rivera. You are authenticated under Read-Only Audit mode for District D1.
                </p>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-3 text-xs bg-slate-50">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Candidate:</span>
                  <span className="font-semibold text-slate-800">Alice Rivera (Digital Democracy)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Affiliation ID:</span>
                  <span className="font-mono text-slate-800">DDP-NAT-8819</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Audit Scope:</span>
                  <span className="text-slate-800">Block Hashes & Merkle Receipts</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Private Vote Decryption:</span>
                  <span className="text-slate-400 italic">Restricted (End-of-Election Multi-Key)</span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close Session
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg bg-amber-50 p-3 text-amber-800 text-xs border border-amber-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Simulated verification check. Pre-filled with verified audit credentials.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Candidate Registration Identifier
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={candidateId}
                    onChange={(e) => setCandidateId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. CAND-2026-ALICE"
                    required
                  />
                  <Shield className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Hardware Security Token PIN / Passkey
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter 6-digit key"
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
                {loading ? "Authenticating HSM Token..." : "Authenticate Observer Login"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
