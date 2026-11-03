import React, { useState } from "react";
import { Search, ShieldCheck, CheckCircle2, AlertOctagon, Hash, Layers, Key } from "lucide-react";

export const ReceiptVerifier: React.FC = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/receipt/${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Receipt verification failed.");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          End-to-End Cryptographic Ballot Receipt Verifier
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Verify your ballot's permanent cryptographic inclusion in the blockchain ledger without revealing your candidate choice.
        </p>
      </div>

      <form onSubmit={handleVerify} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Transaction UUID, Anonymous Token ID, or Block Hash..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify Proof"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Cryptographic Proof Confirmed: Sealed in Block #{result.blockIndex}
            </div>
            <span className="font-mono text-[10px] bg-emerald-200 px-2 py-0.5 rounded text-emerald-900 font-semibold">
              VALIDATED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 font-mono text-[11px]">
            <div className="bg-white p-2.5 rounded border border-emerald-100">
              <span className="text-slate-400 font-sans block text-[10px] font-semibold">
                Block Hash Pointer:
              </span>
              <span className="text-blue-700 break-all">{result.blockHash}</span>
            </div>

            <div className="bg-white p-2.5 rounded border border-emerald-100">
              <span className="text-slate-400 font-sans block text-[10px] font-semibold">
                Merkle Root Tree Digest:
              </span>
              <span className="text-emerald-800 break-all">{result.merkleRoot}</span>
            </div>

            {result.transactionId && (
              <div className="bg-white p-2.5 rounded border border-emerald-100">
                <span className="text-slate-400 font-sans block text-[10px] font-semibold">
                  Transaction Receipt Identifier:
                </span>
                <span className="text-slate-800 break-all">{result.transactionId}</span>
              </div>
            )}

            {result.tokenId && (
              <div className="bg-white p-2.5 rounded border border-emerald-100">
                <span className="text-slate-400 font-sans block text-[10px] font-semibold">
                  Spent Anonymous Token Ref:
                </span>
                <span className="text-slate-800 break-all">{result.tokenId}</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-emerald-800 pt-1">
            Zero-Knowledge Verifiability: This cryptographic proof confirms the transaction's permanent inclusion in the Merkle root of Block #{result.blockIndex} without decrypting or exposing the ballot ciphertext.
          </div>
        </div>
      )}
    </div>
  );
};
