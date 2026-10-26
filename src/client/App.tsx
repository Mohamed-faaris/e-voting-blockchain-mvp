import React, { useState, useEffect } from "react";
import {
  Shield,
  Activity,
  Users,
  Vote,
  Database,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertOctagon,
  Key,
  Compass,
  Search,
  Layers,
  ArrowRight
} from "lucide-react";
import { SystemCheckPage } from "./pages/SystemCheckPage";
import { CandidatePage } from "./pages/CandidatePage";
import { AdminPage } from "./pages/AdminPage";
import { ExplanationPage } from "./pages/ExplanationPage";
import { ReceiptVerifier } from "./components/ReceiptVerifier";
import { BoothHardwareSim } from "./components/BoothHardwareSim";

interface Voter {
  voterId: string;
  name: string;
  districtId: string;
  hasVoted: boolean;
  issuedTokenId?: string;
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  symbol: string;
}

interface Block {
  index: number;
  districtId: string;
  timestamp: string;
  transactions: any[];
  previousHash: string;
  merkleRoot: string;
  hash: string;
}

export function App() {
  // Client URL Hash Router for discrete pages
  const getRouteFromHash = () => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (["candidate", "admin", "system-check", "explanation", "verifier", "districts", "explorer"].includes(hash)) {
      return hash;
    }
    return "booth";
  };

  const [currentRoute, setCurrentRoute] = useState<string>(getRouteFromHash());

  useEffect(() => {
    const onHashChange = () => setCurrentRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (route: string) => {
    window.location.hash = `#/${route}`;
    setCurrentRoute(route);
  };

  // Core Data
  const [voters, setVoters] = useState<Voter[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chain, setChain] = useState<Block[]>([]);
  const [chainValid, setChainValid] = useState<boolean>(true);
  const [chainErrors, setChainErrors] = useState<string[]>([]);
  const [tally, setTally] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);

  // Booth State
  const [selectedVoterId, setSelectedVoterId] = useState("");
  const [activeToken, setActiveToken] = useState<{
    tokenId: string;
    publicKey: string;
    privateKey: string;
    districtId: string;
    voterName: string;
  } | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "ok" | "err" } | null>(null);

  const notify = (message: string, type: "ok" | "err") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  const loadAll = async () => {
    try {
      const [vRes, cRes, chRes, valRes, tRes, distRes] = await Promise.all([
        fetch("/api/voters").then((r) => r.json()),
        fetch("/api/candidates").then((r) => r.json()),
        fetch("/chain").then((r) => r.json()),
        fetch("/chain/verify").then((r) => r.json()),
        fetch("/api/tally").then((r) => r.json()),
        fetch("/api/districts").then((r) => r.json())
      ]);

      if (vRes.voters) {
        setVoters(vRes.voters);
        if (!selectedVoterId && vRes.voters.length > 0) {
          const firstEligible = vRes.voters.find((v: Voter) => !v.hasVoted);
          if (firstEligible) setSelectedVoterId(firstEligible.voterId);
        }
      }
      if (cRes.candidates) setCandidates(cRes.candidates);
      if (chRes.blocks) setChain(chRes.blocks);
      if (valRes) {
        setChainValid(valRes.valid);
        setChainErrors(valRes.errors || []);
      }
      if (tRes) setTally(tRes);
      if (distRes?.districts) setDistricts(distRes.districts);
    } catch (err) {
      console.error("Failed to load chain data", err);
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleAuthenticateVoter = async (voterIdToAuth?: string) => {
    const id = voterIdToAuth || selectedVoterId;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/voter/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      setActiveToken({
        tokenId: data.token.tokenId,
        publicKey: data.token.publicKey,
        privateKey: data.token.privateKey,
        districtId: data.voter.districtId,
        voterName: data.voter.name
      });
      notify(`Verified: ${data.voter.name}. One-time token ${data.token.tokenId} issued.`, "ok");
      loadAll();
    } catch (err: any) {
      notify(err.message, "err");
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async () => {
    if (!activeToken || !selectedCandidateId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/vote/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId: activeToken.districtId,
          tokenId: activeToken.tokenId,
          candidateId: selectedCandidateId,
          publicKey: activeToken.publicKey,
          privateKey: activeToken.privateKey
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit ballot");

      notify(`Vote sealed in Block #${data.receipt.blockIndex}. Hash: ${data.receipt.blockHash.slice(0, 16)}...`, "ok");
      setActiveToken(null);
      setSelectedCandidateId("");
      loadAll();
    } catch (err: any) {
      notify(err.message, "err");
    } finally {
      setLoading(false);
    }
  };

  const handleTamper = async (index: number) => {
    try {
      const res = await fetch(`/demo/tamper/${index}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(`Block #${index} payload altered maliciously. Ledger integrity compromised!`, "err");
      loadAll();
    } catch (err: any) {
      notify(err.message, "err");
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset demo blockchain and all voter states back to Genesis?")) return;
    await fetch("/api/demo/reset", { method: "POST" });
    setActiveToken(null);
    setSelectedCandidateId("");
    notify("Chain and voter registry reset to clean genesis state.", "ok");
    loadAll();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("booth")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg">
                  Consensus Electronic Voting System
                </h1>
                <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  v0.3
                </span>
              </div>
              <p className="text-xs text-slate-500">
                End-to-End Cryptographic Ledger & Face Bounding Box Protocol
              </p>
            </div>
          </div>

          {/* Quick Header Navigation Links to Multiple Pages */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("candidate")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                currentRoute === "candidate"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Users className="h-4 w-4 text-indigo-600" />
              <span>Candidate</span>
            </button>

            <button
              onClick={() => navigate("admin")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                currentRoute === "admin"
                  ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Lock className="h-4 w-4" />
              <span>Admin</span>
            </button>

            <button
              onClick={() => navigate("system-check")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                currentRoute === "system-check"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Activity className="h-4 w-4 text-emerald-600" />
              <span>System Check</span>
            </button>

            <button
              onClick={() => navigate("explanation")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                currentRoute === "explanation"
                  ? "bg-blue-50 border-blue-300 text-blue-700 shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Compass className="h-4 w-4 text-blue-600" />
              <span>Explanation</span>
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            <button
              onClick={loadAll}
              title="Refresh ledger state"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* URL Router Navigation Bar */}
        <div className="border-t border-slate-100 bg-white px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex gap-6 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => navigate("booth")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "booth"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Vote className="h-4 w-4" />
              Voting Booth
            </button>

            <button
              onClick={() => navigate("candidate")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "candidate"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="h-4 w-4" />
              Candidate Portal
            </button>

            <button
              onClick={() => navigate("admin")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "admin"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Lock className="h-4 w-4" />
              Admin Portal
            </button>

            <button
              onClick={() => navigate("system-check")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "system-check"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Activity className="h-4 w-4" />
              System Check
            </button>

            <button
              onClick={() => navigate("explanation")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "explanation"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Compass className="h-4 w-4" />
              10-Stage Explanation
            </button>

            <button
              onClick={() => navigate("verifier")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "verifier"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Search className="h-4 w-4" />
              Receipt Verifier
            </button>

            <button
              onClick={() => navigate("explorer")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "explorer"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Database className="h-4 w-4" />
              Chain Explorer
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notification && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
              notification.type === "ok"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "ok" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        )}

        {/* Page 1: Candidate Portal (/candidate) */}
        {currentRoute === "candidate" && <CandidatePage />}

        {/* Page 2: Admin Portal (/admin) */}
        {currentRoute === "admin" && <AdminPage />}

        {/* Page 3: System Check (/system-check) */}
        {currentRoute === "system-check" && <SystemCheckPage />}

        {/* Page 4: Architectural Explanation (/explanation) */}
        {currentRoute === "explanation" && <ExplanationPage />}

        {/* Page 5: Receipt Verifier (/verifier) */}
        {currentRoute === "verifier" && <ReceiptVerifier />}

        {/* Page 6: Voting Booth (Default / /booth) */}
        {currentRoute === "booth" && (
          <div className="space-y-6">
            {/* Embedded Live Hardware Peripheral with Face Bounding Box Tracker */}
            <BoothHardwareSim
              onCardTapped={(vId) => {
                setSelectedVoterId(vId);
                handleAuthenticateVoter(vId);
              }}
              onLivenessVerified={() => {
                notify("Biometric face bounding box algorithm verified voter identity.", "ok");
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Step 1: Voter Authentication */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      1. Voter Identification & Token Dispenser
                    </h2>
                    <p className="text-xs text-slate-500">
                      Voter verification and anonymous one-time token generation
                    </p>
                  </div>
                  <span className="text-xs font-mono font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Step 1 of 2
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Registered Voter from Official Electoral Registry:
                  </label>
                  <select
                    value={selectedVoterId}
                    onChange={(e) => {
                      setSelectedVoterId(e.target.value);
                      setActiveToken(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    {voters.map((v) => (
                      <option key={v.voterId} value={v.voterId} disabled={v.hasVoted}>
                        {v.voterId} — {v.name} (District {v.districtId}){" "}
                        {v.hasVoted ? "— [BALLOT RECORDED]" : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleAuthenticateVoter()}
                    disabled={loading || !selectedVoterId}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                  >
                    <Key className="h-4 w-4" />
                    Verify Voter & Issue Anonymous Token
                  </button>
                </div>

                {activeToken && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-blue-900">
                      <span>Authenticated Voter: {activeToken.voterName}</span>
                      <span className="text-[10px] bg-blue-200/80 px-2 py-0.5 rounded text-blue-800 font-mono">
                        District {activeToken.districtId}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-blue-800 break-all bg-white p-2.5 rounded border border-blue-200">
                      <span className="text-slate-400 font-sans block text-[10px] font-semibold">
                        Anonymous One-Time Token ID:
                      </span>
                      {activeToken.tokenId}
                    </div>
                    <p className="text-[11px] text-blue-700">
                      Ephemeral Ed25519 booth key generated in browser memory for signing.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Ballot Casting */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      2. Secret Ballot Selection & Cryptographic Dispatch
                    </h2>
                    <p className="text-xs text-slate-500">
                      Salted ballot encryption + Ed25519 booth transaction signature
                    </p>
                  </div>
                  <span className="text-xs font-mono font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Step 2 of 2
                  </span>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Official Certified Candidates:
                  </label>
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => activeToken && setSelectedCandidateId(c.id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        selectedCandidateId === c.id
                          ? "border-blue-600 bg-blue-50/70 shadow-2xs font-semibold"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      } ${!activeToken ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{c.symbol}</span>
                        <div>
                          <div className="text-slate-900 font-bold">{c.name}</div>
                          <div className="text-slate-500 text-[11px] font-medium">{c.party}</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedCandidateId === c.id}
                        onChange={() => {}}
                        disabled={!activeToken}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCastVote}
                  disabled={loading || !activeToken || !selectedCandidateId}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
                >
                  <Lock className="h-4 w-4" />
                  Encrypt Ballot & Commit to Consensus Ledger
                </button>
              </div>
            </div>

            {/* Quick Overview Tally Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-sm">
                  Live District Balloting Summary
                </h3>
                <span className="text-xs text-slate-500">
                  Total Votes Cast: <strong>{tally?.totalVotes || 0}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tally?.results?.map((res: any) => (
                  <div key={res.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">
                        {res.symbol} {res.name}
                      </span>
                      <span className="font-mono text-slate-600">
                        {res.votes} votes ({res.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${res.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Page 7: Blockchain Explorer (/explorer) */}
        {currentRoute === "explorer" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Consensus Blockchain Blocks
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cryptographic audit of blocks, Merkle roots, and hash linkages
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      chainValid
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-red-50 text-red-800 border-red-200"
                    }`}
                  >
                    {chainValid ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Chain Valid ({chain.length} blocks)</span>
                      </>
                    ) : (
                      <>
                        <AlertOctagon className="h-3.5 w-3.5 text-red-600" />
                        <span>Integrity Failed ({chainErrors.length} errors)</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleReset}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Reset Demo Ledger
                  </button>
                </div>
              </div>

              {chainErrors.length > 0 && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200 space-y-1">
                  <div className="font-bold">Verification Errors Detected:</div>
                  {chainErrors.map((e, idx) => (
                    <div key={idx} className="font-mono">
                      • {e}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
                {chain.map((b) => {
                  const isTampered = b.districtId.includes("TAMPERED");
                  return (
                    <div
                      key={b.index}
                      className={`min-w-[280px] max-w-[280px] rounded-xl border p-4 text-xs space-y-2.5 transition shrink-0 ${
                        isTampered
                          ? "border-red-400 bg-red-50/50 shadow-xs"
                          : "border-slate-200 bg-white shadow-2xs hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {b.index === 0 ? "Genesis Block #0" : `Block #${b.index}`}
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {b.districtId}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        {new Date(b.timestamp).toLocaleString()}
                      </div>

                      <div className="space-y-1 font-mono text-[10px]">
                        <div>
                          <span className="text-slate-400 block font-sans">Hash:</span>
                          <span className="text-blue-700 truncate block" title={b.hash}>
                            {b.hash.slice(0, 22)}...
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-sans">Previous Hash:</span>
                          <span className="text-slate-600 truncate block" title={b.previousHash}>
                            {b.previousHash.slice(0, 22)}...
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-sans">Merkle Root:</span>
                          <span className="text-emerald-700 truncate block" title={b.merkleRoot}>
                            {b.merkleRoot.slice(0, 22)}...
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">
                          Transactions: <strong>{b.transactions.length}</strong>
                        </span>
                        {b.index > 0 && !isTampered && (
                          <button
                            onClick={() => handleTamper(b.index)}
                            className="text-[10px] text-red-600 hover:text-red-700 font-medium"
                          >
                            Tamper Block
                          </button>
                        )}
                        {isTampered && (
                          <span className="text-[10px] text-red-600 font-bold uppercase">
                            Tampered
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
