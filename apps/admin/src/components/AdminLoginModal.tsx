import React, { useState } from "react";
import { Lock, ShieldCheck, X, AlertCircle, BarChart3, Users, Database } from "lucide-react";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainStats?: { totalVotes: number; blockCount: number; voterCount: number };
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, chainStats }) => {
  const [username, setUsername] = useState("district_admin");
  const [password, setPassword] = useState("election2026#secure");
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "district_admin" && password === "election2026#secure") {
      setLoggedIn(true);
      setError("");
    } else {
      setError("Invalid administrative credentials. Use hardcoded demo logins.");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Election Officer Portal</h3>
              <p className="text-xs text-slate-500">Administrative telemetry and high-level extrapolated metrics</p>
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
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Officer Session: District Presiding Officer
                  </div>
                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-mono text-slate-700">
                    OFF-D1-849
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Per election security protocol, individual ballot selections remain strictly confidential and encrypted under multi-party custody. Only high-level telemetry and block health are exposed.
                </p>
              </div>

              {/* Extrapolated metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                    Cast Ballots
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {chainStats?.totalVotes ?? 0}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">All authenticated</div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Database className="h-3.5 w-3.5 text-indigo-600" />
                    Ledger Blocks
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {chainStats?.blockCount ?? 1}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Linked & sealed</div>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Users className="h-3.5 w-3.5 text-amber-600" />
                    Turnout %
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {chainStats && chainStats.voterCount > 0
                      ? `${Math.round((chainStats.totalVotes / chainStats.voterCount) * 100)}%`
                      : "0%"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                    {chainStats?.totalVotes || 0} / {chainStats?.voterCount || 5} registered
                  </div>
                </div>
              </div>

              {/* Administrative Actions */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium text-slate-800">Station Operational Mode</div>
                    <div className="text-slate-500 text-[11px]">Accepting certified voter tokens</div>
                  </div>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium text-slate-800">Consensus Key Rotation</div>
                    <div className="text-slate-500 text-[11px]">Scheduled for 23:59 UTC</div>
                  </div>
                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                    ED25519-R3
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Sign Out of Officer Session
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-slate-700 text-xs border border-slate-200">
                <div className="font-semibold text-slate-900 mb-0.5">Demo Presiding Officer Credentials:</div>
                <div className="font-mono text-[11px] text-slate-600">
                  User: <span className="text-slate-900 font-semibold">district_admin</span> | Pass:{" "}
                  <span className="text-slate-900 font-semibold">election2026#secure</span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-red-800 text-xs border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Administrator Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-slate-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Master Officer Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-slate-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs"
              >
                Access Administration Panel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
