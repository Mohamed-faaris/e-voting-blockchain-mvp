import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, AlertCircle, BarChart3, Database, Users, CheckCircle2 } from "lucide-react";

export const AdminPage: React.FC = () => {
  const [username, setUsername] = useState("district_admin");
  const [password, setPassword] = useState("election2026#secure");
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tally, setTally] = useState<any>(null);
  const [voters, setVoters] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/tally").then((r) => r.json()),
      fetch("/api/voters").then((r) => r.json())
    ]).then(([t, v]) => {
      if (t) setTally(t);
      if (v?.voters) setVoters(v.voters);
    });
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "district_admin" && password === "election2026#secure") {
      setLoggedIn(true);
      setError("");
    } else {
      setError("Invalid administrative credentials. Use the hardcoded demo login.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Lock className="h-6 w-6 text-slate-800" />
          Election Administration & Telemetry Portal
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          High-level extrapolated election statistics. Individual ballots remain encrypted and unlinkable.
        </p>
      </div>

      {loggedIn ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Active Session: District Presiding Officer (D1)
              </div>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">
                AUTH-PRESIDING-D1
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Per election security protocol, administrators cannot view or manipulate individual voter selections. Only macro statistics extrapolated from consensus blocks are displayed below.
            </p>

            {/* Extrapolated Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Total Votes Cast
                </div>
                <div className="text-2xl font-bold text-slate-900">{tally?.totalVotes || 0}</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">Verified on blockchain</div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                  <Database className="h-4 w-4 text-indigo-600" />
                  Ledger Height
                </div>
                <div className="text-2xl font-bold text-slate-900">{tally?.blockCount || 1}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Blocks sealed</div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                  <Users className="h-4 w-4 text-amber-600" />
                  Electoral Turnout
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {voters.length > 0 ? `${Math.round(((tally?.totalVotes || 0) / voters.length) * 100)}%` : "0%"}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {tally?.totalVotes || 0} of {voters.length} registered
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setLoggedIn(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Sign Out of Officer Session
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="rounded-lg bg-slate-50 p-3.5 text-slate-700 text-xs border border-slate-200">
            <div className="font-bold text-slate-900 mb-0.5">Hardcoded Presiding Officer Credentials:</div>
            <div className="font-mono text-slate-600 text-[11px]">
              Username: <span className="text-slate-900 font-semibold">district_admin</span> &nbsp;|&nbsp; Password:{" "}
              <span className="text-slate-900 font-semibold">election2026#secure</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-red-800 text-xs border border-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Officer Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Security Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs"
            >
              Sign In to Officer Portal
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
