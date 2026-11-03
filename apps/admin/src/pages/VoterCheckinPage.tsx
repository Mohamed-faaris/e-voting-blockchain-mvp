import React, { useState, useEffect } from "react";
import { Key, Radio, CheckCircle2, AlertOctagon, ArrowRight, ShieldCheck } from "lucide-react";
import { BoothHardwareSim } from "../components/BoothHardwareSim";

interface Voter {
  voterId: string;
  name: string;
  districtId: string;
  hasVoted: boolean;
  issuedTokenId?: string;
}

interface VoterCheckinPageProps {
  onTokenIssued: (tokenData: {
    tokenId: string;
    publicKey: string;
    privateKey: string;
    districtId: string;
    voterName: string;
  }) => void;
  onNavigate: (route: string) => void;
}

export const VoterCheckinPage: React.FC<VoterCheckinPageProps> = ({
  onTokenIssued,
  onNavigate
}) => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [selectedVoterId, setSelectedVoterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<any>(null);

  const fetchVoters = async () => {
    try {
      const res = await fetch("/api/voters");
      const data = await res.json();
      if (data?.voters) {
        setVoters(data.voters);
        if (!selectedVoterId && data.voters.length > 0) {
          const eligible = data.voters.find((v: Voter) => !v.hasVoted);
          if (eligible) setSelectedVoterId(eligible.voterId);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchVoters();
  }, []);

  const handleAuthenticate = async (voterIdToAuth?: string) => {
    const id = voterIdToAuth || selectedVoterId;
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/voter/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      const tokenPayload = {
        tokenId: data.token.tokenId,
        publicKey: data.token.publicKey,
        privateKey: data.token.privateKey,
        districtId: data.voter.districtId,
        voterName: data.voter.name
      };

      setIssuedToken(tokenPayload);
      onTokenIssued(tokenPayload);
      fetchVoters();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Voting Booth · Step 1
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <Radio className="h-6 w-6 text-blue-600" />
            Voter Check-in & Hardware Identity Gate
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tap smartcard on contactless reader or select voter identity, verify face bounding vectors, and receive one-time anonymous voting token.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200">
            Stage 1 / 3
          </span>
        </div>
      </div>

      {/* Embedded Real Hardware & Webcam Bounding Box Module */}
      <BoothHardwareSim
        onCardTapped={(vId) => {
          setSelectedVoterId(vId);
          handleAuthenticate(vId);
        }}
        onLivenessVerified={() => {
          // Liveness gate unlocked
        }}
      />

      {/* Voter Selection & Dispenser */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Official Electoral Roster Lookup
        </h3>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Registered Voter from Electoral Roll:
          </label>
          <select
            value={selectedVoterId}
            onChange={(e) => {
              setSelectedVoterId(e.target.value);
              setIssuedToken(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {voters.map((v) => (
              <option key={v.voterId} value={v.voterId} disabled={v.hasVoted}>
                {v.voterId} — {v.name} (District {v.districtId}){" "}
                {v.hasVoted ? "— [BALLOT ALREADY CAST]" : ""}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleAuthenticate()}
            disabled={loading || !selectedVoterId}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
          >
            <Key className="h-4 w-4" />
            {loading ? "Verifying Credentials..." : "Authenticate Voter & Issue One-Time Token"}
          </button>
        </div>

        {issuedToken && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 border-b border-blue-200 pb-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                Voter Authenticated: {issuedToken.voterName}
              </span>
              <span className="font-mono text-[10px] bg-blue-200 px-2 py-0.5 rounded text-blue-800">
                District {issuedToken.districtId}
              </span>
            </div>

            <div className="font-mono text-xs bg-white p-3 rounded-lg border border-blue-100 text-blue-800 break-all space-y-1">
              <div className="text-[10px] font-sans font-semibold text-slate-400">
                Active Anonymous One-Time Token:
              </div>
              <div className="text-sm font-bold text-blue-700">{issuedToken.tokenId}</div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => onNavigate("booth-ballot")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs"
              >
                Proceed to Secret Ballot Step
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
