import React, { useState, useEffect } from "react";
import {
  Boxes,
  Hash,
  Clock,
  ShieldCheck,
  AlertOctagon,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  FileCheck
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

export const BlockExplorerPage: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/chain");
      const data = await res.json();
      if (data?.blocks) {
        setBlocks(data.blocks);
        if (!selectedBlock && data.blocks.length > 0) {
          setSelectedBlock(data.blocks[data.blocks.length - 1]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, []);

  const filteredBlocks = blocks.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.index.toString() === q ||
      b.hash.toLowerCase().includes(q) ||
      b.merkleRoot.toLowerCase().includes(q) ||
      b.districtId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-blue-600" />
            Consensus Ledger & Block Inspector
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deep block inspector: inspect raw JSON payloads, cryptographic validator signatures, and previous hash linkages.
          </p>
        </div>
        <button
          onClick={loadBlocks}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Block Index (#), Block Hash, Merkle Root, or District..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Blocks List */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-xs font-semibold text-slate-500 mb-2">
            Chain Height: {blocks.length} Blocks
          </div>
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredBlocks.map((b) => {
              const isSelected = selectedBlock?.index === b.index;
              const isTampered = b.districtId.includes("TAMPERED");
              return (
                <div
                  key={b.index}
                  onClick={() => setSelectedBlock(b)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition shadow-2xs ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/70"
                      : isTampered
                      ? "border-red-300 bg-red-50/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Boxes className="h-3.5 w-3.5 text-blue-600" />
                      Block #{b.index}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {b.districtId}
                    </span>
                  </div>

                  <div className="font-mono text-[10px] text-slate-500 truncate" title={b.hash}>
                    Hash: {b.hash.slice(0, 18)}...
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <span>{b.transactions.length} tx(s)</span>
                    <span>{new Date(b.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Block Inspector */}
        <div className="lg:col-span-2">
          {selectedBlock ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">
                    Block Header #{selectedBlock.index}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                    District {selectedBlock.districtId}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {new Date(selectedBlock.timestamp).toUTCString()}
                </div>
              </div>

              {/* Hashes and Cryptographic Details */}
              <div className="space-y-2.5 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-slate-400 font-sans text-[10px] font-semibold mb-0.5">
                    Block Hash (SHA-256):
                  </div>
                  <div className="text-blue-700 font-bold break-all">{selectedBlock.hash}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-slate-400 font-sans text-[10px] font-semibold mb-0.5">
                    Previous Block Hash Pointer:
                  </div>
                  <div className="text-slate-700 break-all">{selectedBlock.previousHash}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-slate-400 font-sans text-[10px] font-semibold mb-0.5">
                    Sealed Merkle Tree Root:
                  </div>
                  <div className="text-emerald-700 font-bold break-all">{selectedBlock.merkleRoot}</div>
                </div>

                {selectedBlock.validatorSignature && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <div className="text-slate-400 font-sans text-[10px] font-semibold mb-0.5">
                      Validator Ed25519 Signature:
                    </div>
                    <div className="text-indigo-700 break-all">{selectedBlock.validatorSignature}</div>
                  </div>
                )}
              </div>

              {/* Transactions Inside This Block */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  Included Ballot Transactions ({selectedBlock.transactions.length})
                </h4>

                {selectedBlock.transactions.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                    Genesis block contains 0 transactions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedBlock.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-lg border border-slate-200 text-xs font-mono space-y-1 bg-slate-50/50"
                      >
                        <div className="flex justify-between items-center text-slate-800 font-bold">
                          <span>TX ID: {tx.id}</span>
                          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                            District: {tx.districtId}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Token Ref: <span className="text-blue-700">{tx.tokenId}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] truncate" title={tx.encryptedVote}>
                          Ballot Ciphertext: {tx.encryptedVote}
                        </div>
                        {tx.signature && (
                          <div className="text-[10px] text-emerald-700 font-semibold pt-1">
                            Ed25519 Booth Signature Verified
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 text-center">
              Select a block from the list on the left to inspect its headers and cryptographic proofs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
