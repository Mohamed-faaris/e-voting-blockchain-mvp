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
  GitFork,
  Boxes,
  Radio,
  FileCheck
} from "lucide-react";
import { SystemCheckPage } from "./pages/SystemCheckPage";
import { CandidatePage } from "./pages/CandidatePage";
import { AdminPage } from "./pages/AdminPage";
import { ExplanationPage } from "./pages/ExplanationPage";
import { MerkleTreePage } from "./pages/MerkleTreePage";
import { BlockExplorerPage } from "./pages/BlockExplorerPage";
import { VoterCheckinPage } from "./pages/VoterCheckinPage";
import { BallotCastingPage } from "./pages/BallotCastingPage";
import { BallotReceiptPage } from "./pages/BallotReceiptPage";
import { ReceiptVerifier } from "./components/ReceiptVerifier";

export function App() {
  const validRoutes = [
    "booth",
    "booth-checkin",
    "booth-ballot",
    "booth-receipt",
    "candidate",
    "admin",
    "system-check",
    "explanation",
    "merkle-tree",
    "blocks",
    "verifier"
  ];

  const getRouteFromHash = () => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (validRoutes.includes(hash)) {
      return hash;
    }
    return "booth-checkin";
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

  // Shared Booth Session State
  const [activeToken, setActiveToken] = useState<{
    tokenId: string;
    publicKey: string;
    privateKey: string;
    districtId: string;
    voterName: string;
  } | null>(null);

  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [notification, setNotification] = useState<{ message: string; type: "ok" | "err" } | null>(null);

  const notify = (message: string, type: "ok" | "err") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("booth-checkin")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg">
                  Consensus Electronic Voting System
                </h1>
                <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  v0.5-prod
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Discrete Multi-Page Voting Booth & Cryptographic Consensus Ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Global Multi-Page Navigation Bar */}
        <div className="border-t border-slate-100 bg-white px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex gap-6 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => navigate("booth-checkin")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "booth-checkin" || currentRoute === "booth"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Radio className="h-4 w-4" />
              1. Voter Check-in
            </button>

            <button
              onClick={() => navigate("booth-ballot")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "booth-ballot"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Vote className="h-4 w-4" />
              2. Secret Ballot
            </button>

            <button
              onClick={() => navigate("booth-receipt")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "booth-receipt"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileCheck className="h-4 w-4" />
              3. Vote Receipt
            </button>

            <div className="h-5 w-px bg-slate-200 self-center" />

            <button
              onClick={() => navigate("candidate")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "candidate"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="h-4 w-4" />
              Candidate Scrutineer
            </button>

            <button
              onClick={() => navigate("admin")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "admin"
                  ? "border-slate-900 text-slate-900 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Lock className="h-4 w-4" />
              Admin Portal
            </button>

            <button
              onClick={() => navigate("blocks")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "blocks"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Boxes className="h-4 w-4" />
              Block Inspector
            </button>

            <button
              onClick={() => navigate("merkle-tree")}
              className={`py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                currentRoute === "merkle-tree"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <GitFork className="h-4 w-4" />
              Merkle Tree
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
          </div>
        </div>
      </header>

      {/* Main Routed Content */}
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

        {/* Voting Booth Flow Stage 1: Checkin & Token Dispenser */}
        {(currentRoute === "booth-checkin" || currentRoute === "booth") && (
          <VoterCheckinPage
            onTokenIssued={(tokenData) => {
              setActiveToken(tokenData);
              notify(`One-time anonymous token issued for ${tokenData.voterName}. Ready for ballot selection.`, "ok");
            }}
            onNavigate={navigate}
          />
        )}

        {/* Voting Booth Flow Stage 2: Secret Ballot Selection */}
        {currentRoute === "booth-ballot" && (
          <BallotCastingPage
            tokenData={activeToken}
            onVoteCast={(receipt) => {
              setLastReceipt(receipt);
              setActiveToken(null);
              notify(`Ballot committed into Block #${receipt.blockIndex}.`, "ok");
            }}
            onNavigate={navigate}
          />
        )}

        {/* Voting Booth Flow Stage 3: Official Cryptographic Vote Receipt */}
        {currentRoute === "booth-receipt" && (
          <BallotReceiptPage
            receipt={lastReceipt}
            onNavigate={navigate}
            onResetSession={() => {
              setActiveToken(null);
              setLastReceipt(null);
            }}
          />
        )}

        {/* Other Dedicated Pages */}
        {currentRoute === "candidate" && <CandidatePage />}
        {currentRoute === "admin" && <AdminPage />}
        {currentRoute === "system-check" && <SystemCheckPage />}
        {currentRoute === "explanation" && <ExplanationPage />}
        {currentRoute === "merkle-tree" && <MerkleTreePage />}
        {currentRoute === "blocks" && <BlockExplorerPage />}
        {currentRoute === "verifier" && <ReceiptVerifier />}
      </main>
    </div>
  );
}
