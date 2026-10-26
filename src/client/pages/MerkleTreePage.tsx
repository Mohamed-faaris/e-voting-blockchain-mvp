import React, { useState, useEffect } from "react";
import {
  GitCommit,
  GitFork,
  Hash,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  FileCode,
  ArrowRight
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

// SHA-256 helper in browser
const sha256 = async (val: string): Promise<string> => {
  const enc = new TextEncoder().encode(val);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const MerkleTreePage: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);
  const [treeLayers, setTreeLayers] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/chain");
      const data = await res.json();
      if (data?.blocks) {
        setBlocks(data.blocks);
        // Default to latest block with transactions or block 0
        const blockWithTx = data.blocks.findLast((b: Block) => b.transactions.length > 0) || data.blocks[0];
        if (blockWithTx) setSelectedBlockIndex(blockWithTx.index);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  // Compute Tree Layers dynamically
  useEffect(() => {
    const active = blocks.find((b) => b.index === selectedBlockIndex);
    if (!active) return;

    const buildTree = async () => {
      if (active.transactions.length === 0) {
        const emptyRoot = await sha256("");
        setTreeLayers([[emptyRoot]]);
        return;
      }

      // Layer 0: Leaves (individual transactions hashed)
      let currentLayer: string[] = [];
      for (const tx of active.transactions) {
        const txCore = {
          id: tx.id,
          districtId: tx.districtId,
          tokenId: tx.tokenId,
          encryptedVote: tx.encryptedVote,
          createdAt: tx.createdAt
        };
        const h = await sha256(JSON.stringify(txCore));
        currentLayer.push(h);
      }

      const allLayers: string[][] = [[...currentLayer]];

      while (currentLayer.length > 1) {
        const nextLayer: string[] = [];
        for (let i = 0; i < currentLayer.length; i += 2) {
          const left = currentLayer[i];
          const right = currentLayer[i + 1] || left;
          const combinedHash = await sha256(left + right);
          nextLayer.push(combinedHash);
        }
        allLayers.unshift([...nextLayer]);
        currentLayer = nextLayer;
      }

      setTreeLayers(allLayers);
    };

    buildTree();
  }, [selectedBlockIndex, blocks]);

  const selectedBlock = blocks.find((b) => b.index === selectedBlockIndex);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GitFork className="h-6 w-6 text-indigo-600" />
            Interactive Merkle Tree Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visual breakdown of transaction leaf hashes cascading into the cryptographic Merkle root digest.
          </p>
        </div>
        <button
          onClick={fetchBlocks}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Chain
        </button>
      </div>

      {/* Block Selector Carousel */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {blocks.map((b) => (
          <button
            key={b.index}
            onClick={() => setSelectedBlockIndex(b.index)}
            className={`px-3 py-2 rounded-lg border text-xs font-mono font-semibold transition whitespace-nowrap ${
              selectedBlockIndex === b.index
                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Block #{b.index} ({b.transactions.length} txs)
          </button>
        ))}
      </div>

      {selectedBlock && (
        <div className="space-y-6">
          {/* Block Overview Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 font-sans block text-[11px] font-semibold">Block Index:</span>
              <strong className="text-slate-900 text-sm">#{selectedBlock.index}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-sans block text-[11px] font-semibold">Sealed Merkle Root:</span>
              <span className="text-indigo-700 font-bold truncate block" title={selectedBlock.merkleRoot}>
                {selectedBlock.merkleRoot}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-sans block text-[11px] font-semibold">Transaction Leaves:</span>
              <span className="text-slate-800 font-bold">{selectedBlock.transactions.length} Leaf Nodes</span>
            </div>
          </div>

          {/* Hierarchical Merkle Tree Visualizer */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-200/80 pb-3">
              <span>Cryptographic Tree Hierarchy</span>
              <span>Root (Top) → Intermediate Nodes → Leaf Hashes (Bottom)</span>
            </div>

            {treeLayers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading tree structure...</div>
            ) : (
              <div className="space-y-6">
                {treeLayers.map((layer, layerIdx) => (
                  <div key={layerIdx} className="space-y-2 text-center">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      {layerIdx === 0
                        ? "Merkle Root (Level 0)"
                        : layerIdx === treeLayers.length - 1
                        ? `Transaction Leaves (Level ${layerIdx})`
                        : `Internal Hash Nodes (Level ${layerIdx})`}
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      {layer.map((hashVal, nodeIdx) => (
                        <div
                          key={nodeIdx}
                          className={`p-3 rounded-lg border text-left shadow-2xs transition ${
                            layerIdx === 0
                              ? "bg-indigo-50 border-indigo-300 text-indigo-900"
                              : "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] font-sans font-semibold text-slate-400 mb-1">
                            <span>
                              {layerIdx === 0 ? "Root Hash" : `Node [${layerIdx}, ${nodeIdx}]`}
                            </span>
                            <Hash className="h-3 w-3 text-slate-400" />
                          </div>
                          <div className="font-mono text-xs font-bold truncate max-w-[240px]" title={hashVal}>
                            {hashVal.slice(0, 16)}...{hashVal.slice(-8)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {layerIdx < treeLayers.length - 1 && (
                      <div className="flex justify-center text-slate-300 text-xs py-1">
                        ↓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaf Transaction Payloads */}
          {selectedBlock.transactions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-600" />
                Underlying Transaction Payloads in Block #{selectedBlock.index}
              </h4>
              <div className="divide-y divide-slate-100 text-xs font-mono">
                {selectedBlock.transactions.map((tx, idx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">
                        Leaf #{idx + 1}: {tx.id}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Token: <span className="text-blue-700">{tx.tokenId}</span> | District: {tx.districtId}
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      CIPHERTEXT INCLUDED
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
