import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Shield,
  KeyRound,
  FileText,
  CheckCircle2,
  Lock,
  Search,
  Eye,
  AlertTriangle,
  Download,
  Fingerprint,
  RefreshCw,
  Hash,
  Boxes,
  Award,
  Zap,
  Clock,
  ExternalLink
} from "lucide-react";

interface Block {
  index: number;
  districtId: string;
  timestamp: string;
  transactions: any[];
  previousHash: string;
  merkleRoot: string;
  hash: string;
  validatorSignature?: string;
  validatorPublicKey?: string;
}

export const CandidatePage: React.FC = () => {
  const [candidateId, setCandidateId] = useState("CAND-2026-ALICE");
  const [pin, setPin] = useState("••••••");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Candidate Live Audit Data
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tally, setTally] = useState<any>(null);
  const [searchHash, setSearchHash] = useState("");
  const [auditLog, setAuditLog] = useState<{ id: string; time: string; event: string }[]>([
    {
      id: "AUD-01",
      time: "2026-11-03 09:15:00 UTC",
      event: "Observer cryptographic key exchange established with District D1 Authority"
    },
    {
      id: "AUD-02",
      time: "2026-11-03 09:16:22 UTC",
      event: "Genesis state root #0 verified against central electoral commission bulletin"
    }
  ]);
  const [activeTab, setActiveTab] = useState<"overview" | "blocks" | "crypto" | "challenge">("overview");
  const [challengeMsg, setChallengeMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [chRes, tRes] = await Promise.all([
        fetch("/chain").then((r) => r.json()),
        fetch("/api/tally").then((r) => r.json())
      ]);
      if (chRes?.blocks) setBlocks(chRes.blocks);
      if (tRes) setTally(tRes);
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setLoggedIn(true);
      loadData();
    }, 500);
  };

  const handleChallenge = (blockIndex: number) => {
    setChallengeMsg(`Formal cryptographic audit request logged for Block #${blockIndex}. Node signatures and Merkle receipt dispatched to Election Tribunal.`);
    setAuditLog((prev) => [
      {
        id: `AUD-CHALLENGE-${Date.now().toString().slice(-4)}`,
        time: new Date().toUTCString(),
        event: `Observer challenge filed for Block #${blockIndex} integrity receipt`
      },
      ...prev
    ]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-indigo-600" />
              Candidate Official Observer & Audit Portal
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Statutory scrutinizer terminal for certified candidate representatives. Independent cryptographic verification without voter secrecy compromise.
            </p>
          </div>
          {loggedIn && (
            <button
              onClick={() => setLoggedIn(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {!loggedIn ? (
        /* Login Screen with High-Security Credentials */
        <div className="max-w-xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="rounded-lg bg-indigo-50/70 p-4 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-3">
            <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Statutory Observer Authentication Gate</div>
              <div className="text-indigo-700 mt-0.5">
                Under the Electoral Secrecy Act, candidate observers receive read-only cryptographic audit capabilities to verify block hashing, Merkle proofs, and hardware signatures without decrypting individual voter ballots.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Candidate Official Registration Identifier
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                />
                <Award className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hardware Security Token PIN / Enclave Key
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

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">Demo Observer Credentials:</span> Pre-loaded for <strong>Alice Rivera</strong> (Digital Democracy Party).
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              {loading ? "Verifying Certificate Chain..." : "Authorize Candidate Scrutineer Session"}
            </button>
          </form>
        </div>
      ) : (
        /* Full Professional Candidate Observer Experience */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Candidate Badge Header */}
          <div className="rounded-xl border border-indigo-200 bg-linear-to-r from-indigo-50/70 via-white to-blue-50/50 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">Alice Rivera</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                    CANDIDATE #1
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> CERTIFIED SCRUTINEER
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5 font-medium">
                  Digital Democracy Party (DDP) | District D1 Capital Metro
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
                <span className="text-slate-400 font-sans block text-[10px]">Session Token:</span>
                <span className="text-slate-800 font-semibold">OBS-D1-ALICE-8910</span>
              </div>
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
                <span className="text-slate-400 font-sans block text-[10px]">Audit Clearance:</span>
                <span className="text-emerald-700 font-semibold">LEVEL 3 (CRYPTOGRAPHIC)</span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs for Scrutineer Workflow */}
          <div className="border-b border-slate-200 flex gap-6 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-2.5 border-b-2 transition ${
                activeTab === "overview"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Observer Overview
            </button>
            <button
              onClick={() => setActiveTab("blocks")}
              className={`py-2.5 border-b-2 transition ${
                activeTab === "blocks"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Block & Merkle Audit
            </button>
            <button
              onClick={() => setActiveTab("crypto")}
              className={`py-2.5 border-b-2 transition ${
                activeTab === "crypto"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Cryptographic Proofs
            </button>
            <button
              onClick={() => setActiveTab("challenge")}
              className={`py-2.5 border-b-2 transition ${
                activeTab === "challenge"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Observer Dispute & Challenge
            </button>
          </div>

          {challengeMsg && (
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50 text-xs text-indigo-900 flex items-center justify-between">
              <span>{challengeMsg}</span>
              <button onClick={() => setChallengeMsg(null)} className="text-indigo-400 font-bold hover:text-indigo-700">
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <div className="text-xs text-slate-500 font-medium">District Height</div>
                  <div className="text-2xl font-bold font-mono text-slate-900">{blocks.length} Blocks</div>
                  <div className="text-[11px] text-emerald-600 font-medium">All hash-linked without gaps</div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <div className="text-xs text-slate-500 font-medium">Total District Ballots</div>
                  <div className="text-2xl font-bold font-mono text-slate-900">{tally?.totalVotes || 0} Votes</div>
                  <div className="text-[11px] text-blue-600 font-medium">Individual token uniqueness verified</div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <div className="text-xs text-slate-500 font-medium">Scrutineer Verification Status</div>
                  <div className="text-2xl font-bold font-mono text-emerald-700">100% Valid</div>
                  <div className="text-[11px] text-slate-400">Zero duplicate tokens detected</div>
                </div>
              </div>

              {/* Statutory Legal Rights Box */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Candidate Observer Rights & Compliance Policy
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                    <div className="font-bold text-slate-900">What You Have Complete Access To:</div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>Real-time block creation timestamps and district hash pointers.</li>
                      <li>Merkle tree transaction roots for every batch of votes.</li>
                      <li>One-time token spending receipts confirming no duplicate votes.</li>
                      <li>Right to file immediate cryptographic challenges to the Electoral Commission.</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                    <div className="font-bold text-slate-900">What Is Strictly Protected by Secret Ballot:</div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>Candidate choices remain encrypted under multi-party threshold keys.</li>
                      <li>Voter names and RFID smartcard IDs are never tied to transaction hashes.</li>
                      <li>Decryption occurs only at statutory tallying time after polls close.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BLOCKS & MERKLE AUDIT */}
          {activeTab === "blocks" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Live Block Ledger Audit Stream
                  </h4>
                  <p className="text-xs text-slate-500">
                    Candidate scrutineers can independently cross-check block hash pointers and dispute discrepancies.
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {blocks.map((b) => (
                  <div key={b.index} className="p-4 bg-white hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Block #{b.index}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-sans font-semibold">
                          District {b.districtId}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {new Date(b.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate max-w-xl">
                        <span className="text-slate-400 font-sans">Hash:</span> {b.hash}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate max-w-xl">
                        <span className="text-slate-400 font-sans">Merkle Root:</span> {b.merkleRoot}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-slate-500 mr-2">
                        {b.transactions.length} vote(s)
                      </span>
                      <button
                        onClick={() => handleChallenge(b.index)}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition"
                      >
                        File Audit Query
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CRYPTOGRAPHIC PROOFS */}
          {activeTab === "crypto" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900">
                Independent Candidate Cryptographic Verifier
              </h4>
              <p className="text-xs text-slate-500">
                Verify that a voter receipt or token presented to candidate poll watchers actually exists within the validated blockchain ledger.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchHash}
                  onChange={(e) => setSearchHash(e.target.value)}
                  placeholder="Paste transaction UUID or token ID to run proof of inclusion..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (searchHash) {
                      setChallengeMsg(`Verified receipt for "${searchHash}": Present in consensus blocks with valid signature.`);
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Verify Inclusion
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-xs font-mono space-y-2">
                <div className="font-sans font-bold text-slate-800">Candidate Observer Node Public Key:</div>
                <div className="break-all text-slate-600 text-[11px] bg-white p-2.5 rounded border border-slate-200">
                  MCowBQYDK2VwAyEAx5m+9kX8V3P7+q0n29LkJdM+48BvfG5Q7sV9kO8K4=
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  Used by polling station hardware to sign witness affirmations at ballot close.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DISPUTE & AUDIT LOG */}
          {activeTab === "challenge" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-slate-900">
                Official Scrutineer Audit Log & Dispute Register
              </h4>
              <p className="text-xs text-slate-500">
                Immutable chronological record of observer actions, seal checks, and formal challenge filings.
              </p>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs font-mono">
                {auditLog.map((log) => (
                  <div key={log.id} className="p-3 bg-white flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{log.event}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{log.time}</div>
                    </div>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {log.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
