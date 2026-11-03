import React from "react";
import { CheckCircle2, ShieldCheck, ArrowRight, Hash, Layers, Lock, Search, RefreshCw } from "lucide-react";

interface BallotReceiptPageProps {
  receipt: {
    blockIndex: number;
    blockHash: string;
    transactionId: string;
    timestamp: string;
    candidate?: string;
    tokenId?: string;
  } | null;
  onNavigate: (route: string) => void;
  onResetSession: () => void;
}

export const BallotReceiptPage: React.FC<BallotReceiptPageProps> = ({
  receipt,
  onNavigate,
  onResetSession
}) => {
  if (!receipt) {
    return (
      <div className="max-w-xl mx-auto rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <ShieldCheck className="h-10 w-10 mx-auto text-slate-400" />
        <h3 className="text-base font-bold text-slate-900">No Recent Ballot Receipt</h3>
        <p className="text-xs text-slate-500">
          Cast your ballot in the voting booth to generate an immutable cryptographic receipt.
        </p>
        <button
          onClick={() => onNavigate("booth-checkin")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
        >
          Go to Step 1: Check-in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Voting Booth · Step 3
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            Ballot Successfully Sealed on Blockchain
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Your ballot is permanently recorded in a hash-linked block. Save your receipt for zero-knowledge verifiability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg border border-emerald-200">
            Stage 3 / 3
          </span>
        </div>
      </div>

      {/* Official Cryptographic Receipt Certificate Card */}
      <div className="rounded-xl border border-emerald-200 bg-linear-to-b from-emerald-50/40 via-white to-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Cryptographic Vote Record Certificate
          </div>
          <span className="text-[10px] font-mono bg-emerald-100 px-2.5 py-0.5 rounded text-emerald-900 font-bold">
            CONFIRMED
          </span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
            <span className="text-slate-400 font-sans block text-[10px] font-semibold">
              Sealed Blockchain Block Height:
            </span>
            <strong className="text-slate-900 text-sm font-sans">Block #{receipt.blockIndex}</strong>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
            <span className="text-slate-400 font-sans block text-[10px] font-semibold">
              Permanent Block Hash Pointer:
            </span>
            <div className="text-blue-700 font-bold break-all">{receipt.blockHash}</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
            <span className="text-slate-400 font-sans block text-[10px] font-semibold">
              Transaction UUID:
            </span>
            <div className="text-slate-800 break-all">{receipt.transactionId}</div>
          </div>

          {receipt.tokenId && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
              <span className="text-slate-400 font-sans block text-[10px] font-semibold">
                Redeemed One-Time Anonymous Token:
              </span>
              <div className="text-slate-600">{receipt.tokenId} (Marked SPENT)</div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
            <span className="text-slate-400 font-sans block text-[10px] font-semibold">
              Consensus Timestamp:
            </span>
            <div className="text-slate-700 font-sans text-xs">
              {new Date(receipt.timestamp).toUTCString()}
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-700" />
            Zero-Knowledge Verifiability Guarantee:
          </div>
          <div>
            Anyone possessing your Transaction UUID or Block Hash can prove your ballot was mathematically included in the Merkle root of Block #{receipt.blockIndex}, but no one can deduce which candidate you selected.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => onNavigate("verifier")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Search className="h-4 w-4 text-blue-600" />
            Test Inclusion in Receipt Verifier
          </button>

          <button
            onClick={() => {
              onResetSession();
              onNavigate("booth-checkin");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Finish & Reset Booth for Next Voter
          </button>
        </div>
      </div>
    </div>
  );
};
