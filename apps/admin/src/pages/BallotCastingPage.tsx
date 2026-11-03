import React, { useState, useEffect } from "react";
import { Vote, Lock, Shield, Zap, Sprout, ArrowLeft, ArrowRight, AlertOctagon, CheckCircle2 } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  party: string;
  symbol: string;
}

interface BallotCastingPageProps {
  tokenData: {
    tokenId: string;
    publicKey: string;
    privateKey: string;
    districtId: string;
    voterName: string;
  } | null;
  onVoteCast: (receipt: any) => void;
  onNavigate: (route: string) => void;
}

export const BallotCastingPage: React.FC<BallotCastingPageProps> = ({
  tokenData,
  onVoteCast,
  onNavigate
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [castSuccessReceipt, setCastSuccessReceipt] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => {
        if (d?.candidates) setCandidates(d.candidates);
      });
  }, []);

  const handleCast = async () => {
    if (!tokenData || !selectedCandidateId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vote/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId: tokenData.districtId,
          tokenId: tokenData.tokenId,
          candidateId: selectedCandidateId,
          publicKey: tokenData.publicKey,
          privateKey: tokenData.privateKey
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to commit ballot to blockchain.");

      const receiptPayload = {
        ...data.receipt,
        candidate: data.candidate,
        tokenId: tokenData.tokenId
      };
      setCastSuccessReceipt(receiptPayload);
      onVoteCast(receiptPayload);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!tokenData) {
    return (
      <div className="max-w-xl mx-auto rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <Lock className="h-10 w-10 mx-auto text-amber-500" />
        <h3 className="text-base font-bold text-slate-900">No Active Voting Token Found</h3>
        <p className="text-xs text-slate-500">
          You must complete voter identification and receive an anonymous one-time token before casting your ballot.
        </p>
        <button
          onClick={() => onNavigate("booth-checkin")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to Step 1: Check-in & Token Issuance
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Voting Booth · Step 2
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <Vote className="h-6 w-6 text-blue-600" />
            Secret Ballot Selection
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose your certified candidate. Your ballot will be encrypted with the election public key and signed with your session's Ed25519 booth key.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200">
            Stage 2 / 3
          </span>
        </div>
      </div>

      {/* Active Token Banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-blue-900">
          <span className="font-sans font-semibold text-slate-500">Active Token:</span>
          <span className="font-bold">{tokenData.tokenId}</span>
          <span className="text-slate-400">|</span>
          <span className="font-sans text-slate-600">Voter: {tokenData.voterName}</span>
        </div>
        <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
          UNSPENT
        </span>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Candidate Selection List */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-slate-700">
          Select One Candidate from Certified Ballot:
        </label>

        {candidates.map((c) => {
          const isSelected = selectedCandidateId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCandidateId(c.id)}
              className={`p-4 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between shadow-2xs ${
                isSelected
                  ? "border-blue-600 bg-blue-50/70 font-semibold"
                  : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  {c.id === "cand-1" ? (
                    <Zap className="h-5 w-5 text-blue-600" />
                  ) : c.id === "cand-2" ? (
                    <Shield className="h-5 w-5 text-indigo-600" />
                  ) : (
                    <Sprout className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <div className="text-slate-900 font-bold text-sm">{c.name}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{c.party} ({c.symbol})</div>
                </div>
              </div>

              <input
                type="radio"
                name="candidate_choice"
                checked={isSelected}
                onChange={() => {}}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
            </div>
          );
        })}
      </div>

      {/* Success Notification if ballot was committed */}
      {castSuccessReceipt && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-200 pb-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Ballot Successfully Encrypted & Committed to Blockchain!
            </span>
            <span className="font-mono text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
              Block #{castSuccessReceipt.blockIndex}
            </span>
          </div>
          <div className="text-xs text-emerald-800">
            Transaction ID: <span className="font-mono font-bold">{castSuccessReceipt.txId}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCastSuccessReceipt(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
            >
              Dismiss
            </button>
            <button
              onClick={() => onNavigate("booth-receipt")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-xs"
            >
              View Official Receipt & Certificate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button
          onClick={() => onNavigate("booth-checkin")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Check-in
        </button>

        <button
          onClick={handleCast}
          disabled={loading || !selectedCandidateId}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
        >
          <Lock className="h-4 w-4" />
          {loading ? "Encrypting & Committing to Chain..." : "Encrypt & Seal Ballot on Blockchain"}
        </button>
      </div>
    </div>
  );
};
