import React, { useState } from "react";
import {
  ShieldCheck,
  Key,
  Lock,
  FileCheck,
  CheckCircle2,
  Boxes,
  Link as LinkIcon,
  Layers,
  Archive,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  RotateCcw,
  Play,
  Check,
  X
} from "lucide-react";

// Hash function simulation matching the demo script
const hx = (s: string, n = 16): string => {
  let a = 0xdeadbeef,
    b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  let o = (b >>> 0).toString(16).padStart(8, "0") + (a >>> 0).toString(16).padStart(8, "0");
  while (o.length < n) o += hx(o, 16);
  return o.slice(0, n);
};

const rnd = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

export const ExaminerFlow: React.FC = () => {
  const [currentStage, setCurrentStage] = useState(0);

  // Stage 1 State
  const [spoofPhoto, setSpoofPhoto] = useState(false);
  const [authChecks, setAuthChecks] = useState<("idle" | "running" | "ok" | "bad" | "skip")[]>([
    "idle",
    "idle",
    "idle",
    "idle",
    "idle"
  ]);
  const [authRunning, setAuthRunning] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ text: string; type: "ok" | "bad" } | null>(null);

  // Stage 2 State
  const [tokenVal, setTokenVal] = useState<string | null>(null);

  // Stage 3 State
  const [selectedCandidate, setSelectedCandidate] = useState("Candidate A");
  const [encryptedBallot, setEncryptedBallot] = useState<string | null>(null);
  const [encryptCount, setEncryptCount] = useState(0);

  // Stage 4 State
  const [txObj, setTxObj] = useState<{ tok: string; v: string; t: string }>({
    tok: "tok_" + rnd(12),
    v: hx("vote_cand_a", 32),
    t: "2026-11-03T09:14:07Z"
  });
  const [signature, setSignature] = useState<string | null>(null);
  const [sigMsg, setSigMsg] = useState<{ text: string; type: "ok" | "bad" } | null>(null);

  // Stage 5 State
  const [spentTokens, setSpentTokens] = useState<Set<string>>(new Set());
  const [spentMsg, setSpentMsg] = useState<{ text: string; type: "ok" | "bad" } | null>(null);

  // Stage 6 State
  const [validatorFaults, setValidatorFaults] = useState({
    cert: false,
    sig: false,
    tok: false,
    ts: false
  });
  const [valChecks, setValChecks] = useState<("idle" | "running" | "ok" | "bad" | "skip")[]>([
    "idle",
    "idle",
    "idle",
    "idle",
    "idle"
  ]);
  const [valRunning, setValRunning] = useState(false);
  const [valMsg, setValMsg] = useState<{ text: string; type: "ok" | "bad" } | null>(null);

  // Stage 7 State
  const [txPool, setTxPool] = useState<string[]>([]);
  const [sealedBlock, setSealedBlock] = useState<{
    prev: string;
    merkleRoot: string;
    sig: string;
    txs: string[];
  } | null>(null);

  // Stage 8 State
  const [blocks, setBlocks] = useState([
    { id: 0, label: "Genesis", data: "Genesis Block", tampered: false },
    { id: 1, label: "Block 1", data: "tx_9f81a7b (Vote A)", tampered: false },
    { id: 2, label: "Block 2", data: "tx_1a4e8d3 (Vote B)", tampered: false },
    { id: 3, label: "Block 3", data: "tx_7c3b291 (Vote C)", tampered: false }
  ]);

  // Stage 9 State
  const [nodeHierarchy, setNodeHierarchy] = useState<{ [key: string]: "idle" | "lit" | "dead" }>({
    district: "idle",
    state: "idle",
    national: "idle"
  });
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Stage 10 State
  const [auditAlerts, setAuditAlerts] = useState<string[]>([]);

  // Stage 1: Run Auth
  const runAuth = async () => {
    setAuthRunning(true);
    setAuthMsg(null);
    const checks: ("idle" | "running" | "ok" | "bad" | "skip")[] = ["idle", "idle", "idle", "idle", "idle"];
    setAuthChecks([...checks]);

    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 400));
      if (spoofPhoto && i === 2) {
        checks[i] = "bad";
        for (let j = 3; j < 5; j++) checks[j] = "skip";
        setAuthChecks([...checks]);
        setAuthMsg({
          text: "Liveness verification failed: static photo does not blink or register 3D depth. Token denied.",
          type: "bad"
        });
        setAuthRunning(false);
        return;
      }
      checks[i] = "ok";
      setAuthChecks([...checks]);
    }

    setAuthMsg({
      text: "All physical and biometric checks passed. Verification server authorizes token generation.",
      type: "ok"
    });
    setAuthRunning(false);
  };

  // Stage 2: Token Gen
  const issueToken = () => {
    const t = "tok_" + rnd(24);
    setTokenVal(t);
  };

  // Stage 3: Encrypt Vote
  const encryptVote = () => {
    const cipher = hx(selectedCandidate + rnd(8), 48);
    setEncryptedBallot(cipher);
    setEncryptCount((c) => c + 1);
  };

  // Stage 4: Sign Transaction
  const handleSign = () => {
    const s = hx("booth-key|" + JSON.stringify(txObj), 32);
    setSignature(s);
    setSigMsg({
      text: "Transaction payload signed with Ed25519 booth key. Cryptographic proof sealed.",
      type: "ok"
    });
  };

  const handleTamperTimestamp = () => {
    setTxObj((prev) => ({ ...prev, t: "2026-11-03T23:59:59Z" }));
    setSigMsg({ text: "Timestamp altered in payload after signature creation.", type: "bad" });
  };

  const handleVerifySig = () => {
    if (!signature) {
      setSigMsg({ text: "No signature created yet. Click 'Sign' first.", type: "bad" });
      return;
    }
    const expected = hx("booth-key|" + JSON.stringify(txObj), 32);
    if (expected === signature) {
      setSigMsg({ text: "Signature valid. Payload exactly matches signed contents.", type: "ok" });
    } else {
      setSigMsg({
        text: "Signature invalid: payload contents have been altered since signing.",
        type: "bad"
      });
    }
  };

  // Stage 5: Unspent check
  const submitToken = () => {
    const t = tokenVal || "tok_voter_alpha";
    if (spentTokens.has(t)) {
      setSpentMsg({
        text: `Rejected: Token ${t} has already been marked as SPENT. Duplicate vote rejected with HTTP 409!`,
        type: "bad"
      });
    } else {
      setSpentTokens((prev) => new Set([...prev, t]));
      setSpentMsg({
        text: `Accepted: Token ${t} recorded as SPENT in single atomic database transaction.`,
        type: "ok"
      });
    }
  };

  // Stage 6: Validator
  const runValidation = async () => {
    setValRunning(true);
    setValMsg(null);
    const checks: ("idle" | "running" | "ok" | "bad" | "skip")[] = ["idle", "idle", "idle", "idle", "idle"];
    setValChecks([...checks]);

    const faults = [
      validatorFaults.cert,
      validatorFaults.sig,
      validatorFaults.tok,
      validatorFaults.ts,
      false
    ];

    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 380));
      if (faults[i]) {
        checks[i] = "bad";
        for (let j = i + 1; j < 5; j++) checks[j] = "skip";
        setValChecks([...checks]);
        setValMsg({
          text: `Validation failed at check ${i + 1}. Transaction dropped from pending mempool. Alert broadcasted.`,
          type: "bad"
        });
        setValRunning(false);
        return;
      }
      checks[i] = "ok";
      setValChecks([...checks]);
    }

    setValMsg({
      text: "All 5 district validation checks passed. Transaction placed into block staging pool.",
      type: "ok"
    });
    setValRunning(false);
  };

  // Stage 7: Seal Block
  const addTxToPool = () => {
    setTxPool((prev) => [...prev, "tx_" + rnd(8)]);
  };

  const sealCurrentBlock = () => {
    if (txPool.length === 0) return;
    const mr = hx(txPool.join("|"), 24);
    setSealedBlock({
      prev: hx("prev_block", 16),
      merkleRoot: mr,
      sig: hx("district-node-key" + mr, 24),
      txs: [...txPool]
    });
    setTxPool([]);
  };

  // Stage 8: Tamper chain
  const toggleBlockTamper = (id: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, tampered: !b.tampered } : b))
    );
  };

  // Stage 9: Sync
  const runSync = async () => {
    setNodeHierarchy({ district: "idle", state: "idle", national: "idle" });
    setSyncMsg(null);
    await new Promise((r) => setTimeout(r, 300));
    setNodeHierarchy((prev) => ({ ...prev, district: "lit" }));
    await new Promise((r) => setTimeout(r, 450));
    setNodeHierarchy((prev) => ({ ...prev, state: "lit" }));
    await new Promise((r) => setTimeout(r, 450));
    setNodeHierarchy((prev) => ({ ...prev, national: "lit" }));
    setSyncMsg("Checkpoint root synchronized across District, State, and National consensus nodes.");
  };

  const failDistrict = async () => {
    setNodeHierarchy({ district: "dead", state: "idle", national: "idle" });
    setSyncMsg("District node disconnected. Local booths switch to isolated tamper-sealed buffer.");
    await new Promise((r) => setTimeout(r, 1200));
    setNodeHierarchy({ district: "lit", state: "lit", national: "idle" });
    setSyncMsg("Checkpoint recovered from State registry. Chain integrity restored.");
  };

  const stagesList = [
    {
      part: "Part 1 · Voting Booth",
      title: "Authenticate Voter",
      icon: ShieldCheck,
      desc: "Before casting, voter identity is proven through independent factors to prevent identity theft."
    },
    {
      part: "Part 1 · Voting Booth",
      title: "Anonymous Token",
      icon: Key,
      desc: "Authentication server issues an unlinked one-time token that authorizes exactly one vote."
    },
    {
      part: "Part 1 · Voting Booth",
      title: "Ballot Encryption",
      icon: Lock,
      desc: "Ballot is encrypted with the election public key. Ciphertext changes on each encryption."
    },
    {
      part: "Part 1 · Voting Booth",
      title: "Booth Signature",
      icon: FileCheck,
      desc: "Transaction is signed using an Ed25519 private key securely stored in the booth hardware HSM."
    },
    {
      part: "Part 2 · Ledger Validation",
      title: "Unspent Token Guard",
      icon: CheckCircle2,
      desc: "Atomic duplicate-spending rejection ensures a token cannot be submitted twice."
    },
    {
      part: "Part 2 · Ledger Validation",
      title: "District Validator",
      icon: ShieldCheck,
      desc: "District validator independently verifies certificate, signature, token, timestamp, and district rules."
    },
    {
      part: "Part 2 · Ledger Validation",
      title: "Merkle Block Sealing",
      icon: Boxes,
      desc: "Validated transactions are organized into a Merkle tree root and sealed into a block."
    },
    {
      part: "Part 2 · Ledger Validation",
      title: "Hash-Linked Chain",
      icon: LinkIcon,
      desc: "Each block references the cryptographic hash of the previous block, rendering tampering instantly visible."
    },
    {
      part: "Part 2 · Ledger Validation",
      title: "Hierarchy Checkpoints",
      icon: Layers,
      desc: "District blocks checkpoint upward into state and national ledgers for disaster recovery."
    },
    {
      part: "Part 2 · Ledger Validation",
      title: "Audit & Surveillance",
      icon: Archive,
      desc: "Long-term public audit log telemetry and infrastructure alerts without voter identity exposure."
    }
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Interactive Protocol Architecture Examiner
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Step through the ten foundational stages of the end-to-end cryptographic voting pipeline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
              Stage {currentStage + 1} of 10
            </span>
          </div>
        </div>

        {/* Stage Tabs Navigation */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
          {stagesList.map((st, i) => {
            const Icon = st.icon;
            const isActive = currentStage === i;
            return (
              <button
                key={i}
                onClick={() => setCurrentStage(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>
                  {i + 1}. {st.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Stage Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border-r border-slate-100 pr-4 space-y-4">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            {stagesList[currentStage].part}
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {currentStage + 1}. {stagesList[currentStage].title}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {stagesList[currentStage].desc}
          </p>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-900">Security Requirement:</div>
            {currentStage === 0 && (
              <p>Physical card possession must be paired with biological liveness to defeat identity spoofing.</p>
            )}
            {currentStage === 1 && (
              <p>The token must be cryptographically unlinkable to the voter record in the authentication database.</p>
            )}
            {currentStage === 2 && (
              <p>Ballot encryption must incorporate fresh randomness (nonce/salt) so identical votes yield different ciphertexts.</p>
            )}
            {currentStage === 3 && (
              <p>Ed25519 signatures authenticate the certified terminal and guarantee payload integrity in transit.</p>
            )}
            {currentStage === 4 && (
              <p>Atomic status transitions prevent race conditions where a token could be submitted simultaneously.</p>
            )}
            {currentStage === 5 && (
              <p>A multi-point validator check discards unauthorized transactions before they can enter block assembly.</p>
            )}
            {currentStage === 6 && (
              <p>Merkle roots permit succinct proofs of inclusion without requiring full transaction lookups.</p>
            )}
            {currentStage === 7 && (
              <p>Cryptographic hash pointers make retro-active modifications mathematically detectable.</p>
            )}
            {currentStage === 8 && (
              <p>State and national checkpoints ensure local disaster resilience and prevent partition forks.</p>
            )}
            {currentStage === 9 && (
              <p>Public accountability requires transparency of block hashes without disclosing voter choices.</p>
            )}
          </div>
        </div>

        {/* Interactive Playground Section */}
        <div className="md:col-span-2 space-y-4">
          {/* Stage 1: Auth Checks */}
          {currentStage === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spoofPhoto}
                    onChange={(e) => setSpoofPhoto(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Simulate Attack: Hold up high-resolution printed photo</span>
                </label>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {[
                  "1. Contactless voter card read (RPIC / NFC)",
                  "2. Facial vector template matching against voter registry",
                  "3. 3D depth and micro-blink liveness verification",
                  "4. Ephemeral SMS / Authenticator one-time authorization",
                  "5. Eligibility status and unvoted flag check"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white">
                    <span className="text-slate-800 font-medium">{item}</span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      {authChecks[idx] === "idle" && <span className="text-slate-400">Pending</span>}
                      {authChecks[idx] === "ok" && (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Passed
                        </span>
                      )}
                      {authChecks[idx] === "bad" && (
                        <span className="text-red-600 font-semibold flex items-center gap-1">
                          <X className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                      {authChecks[idx] === "skip" && (
                        <span className="text-slate-400 font-medium">Bypassed</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={runAuth}
                  disabled={authRunning}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Physical & Biometric Checks
                </button>
              </div>

              {authMsg && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    authMsg.type === "ok"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {authMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Stage 2: Anonymous Token */}
          {currentStage === 1 && (
            <div className="space-y-4">
              <button
                onClick={issueToken}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                <Key className="h-3.5 w-3.5" />
                Generate One-Time Anonymous Voting Token
              </button>

              {tokenVal ? (
                <div className="space-y-2">
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs font-mono">
                    <div className="text-slate-500 text-[10px] uppercase font-sans font-semibold mb-1">
                      One-Time Voting Token:
                    </div>
                    <div className="text-blue-700 font-bold break-all">{tokenVal}</div>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 bg-white text-xs">
                    <span className="text-slate-500 font-medium">Token Metadata:</span>{" "}
                    <span className="text-slate-800">
                      Cryptographically pseudorandom string. Stripped of all personal identifiers, biometric vectors, and voter registry IDs.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                  Click the button above to simulate token issuance.
                </div>
              )}
            </div>
          )}

          {/* Stage 3: Ballot Encryption */}
          {currentStage === 2 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {["Candidate A (Digital Democracy)", "Candidate B (Civic Integrity)", "Candidate C (Transparency)"].map(
                  (c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCandidate(c)}
                      className={`flex-1 p-2.5 rounded-lg border text-xs font-medium text-left transition ${
                        selectedCandidate === c
                          ? "border-blue-600 bg-blue-50/60 text-blue-900 font-semibold"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={encryptVote}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                <Lock className="h-3.5 w-3.5" />
                Encrypt Ballot with Election Public Key
              </button>

              {encryptedBallot && (
                <div className="space-y-2">
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs font-mono">
                    <div className="text-slate-500 text-[10px] uppercase font-sans font-semibold mb-1">
                      Stored Ciphertext Payload:
                    </div>
                    <div className="text-indigo-700 font-bold break-all">{encryptedBallot}</div>
                  </div>
                  <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                    Notice: Each time you re-encrypt, the ciphertext changes completely (Encryption count:{" "}
                    <strong>{encryptCount}</strong>) due to cryptographic salt/nonce incorporation.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage 4: Sign Transaction */}
          {currentStage === 3 && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs font-mono space-y-1">
                <div>
                  <span className="text-slate-500">Token ID:</span> {txObj.tok}
                </div>
                <div>
                  <span className="text-slate-500">Encrypted Ballot:</span> {txObj.v.slice(0, 24)}...
                </div>
                <div>
                  <span className="text-slate-500">Timestamp:</span> {txObj.t}
                </div>
                <div>
                  <span className="text-slate-500">Signature:</span>{" "}
                  <span className={signature ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                    {signature || "(Not signed yet)"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSign}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Sign with Ed25519 HSM Key
                </button>
                <button
                  onClick={handleTamperTimestamp}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                >
                  Tamper Timestamp
                </button>
                <button
                  onClick={handleVerifySig}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Verify Signature
                </button>
              </div>

              {sigMsg && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    sigMsg.type === "ok"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {sigMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Stage 5: Duplicate Token Guard */}
          {currentStage === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Clicking "Submit Token" tests the atomic unique constraint. The first submission succeeds; any repeat attempt with the same token is rejected.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={submitToken}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Submit Token to Ledger
                </button>
                <button
                  onClick={() => {
                    setSpentTokens(new Set());
                    setSpentMsg(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Reset Token State
                </button>
              </div>

              {spentMsg && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    spentMsg.type === "ok"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {spentMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Stage 6: Validator */}
          {currentStage === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: "cert", label: "Revoke booth certificate" },
                  { key: "sig", label: "Alter cryptographic signature" },
                  { key: "tok", label: "Simulate reused token" },
                  { key: "ts", label: "Provide mismatched timestamp" }
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={(validatorFaults as any)[item.key]}
                      onChange={(e) =>
                        setValidatorFaults((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="rounded border-slate-300"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {[
                  "1. Booth certificate trusted by Root Authority",
                  "2. Ed25519 digital signature verified",
                  "3. Token status confirmed UNSPENT in consensus ledger",
                  "4. Election district & timestamp window matched",
                  "5. Transaction payload passes schema verification"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-white">
                    <span className="text-slate-800">{item}</span>
                    <span className="font-mono text-[11px]">
                      {valChecks[idx] === "idle" && <span className="text-slate-400">Waiting</span>}
                      {valChecks[idx] === "ok" && (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="h-3 w-3" /> Valid
                        </span>
                      )}
                      {valChecks[idx] === "bad" && (
                        <span className="text-red-600 font-semibold flex items-center gap-1">
                          <X className="h-3 w-3" /> Rejected
                        </span>
                      )}
                      {valChecks[idx] === "skip" && (
                        <span className="text-slate-400">Skipped</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={runValidation}
                disabled={valRunning}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                Execute Multi-Point Validator
              </button>

              {valMsg && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    valMsg.type === "ok"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {valMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Stage 7: Block Sealing */}
          {currentStage === 6 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={addTxToPool}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Add Transaction to Pool ({txPool.length})
                </button>
                <button
                  onClick={sealCurrentBlock}
                  disabled={txPool.length === 0}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Seal & Sign Block
                </button>
              </div>

              {sealedBlock && (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs font-mono space-y-1">
                  <div className="font-semibold text-slate-800 font-sans mb-1">Sealed Block Header:</div>
                  <div>
                    <span className="text-slate-500">Previous Hash:</span> {sealedBlock.prev}
                  </div>
                  <div>
                    <span className="text-slate-500">Merkle Root:</span> {sealedBlock.merkleRoot}
                  </div>
                  <div>
                    <span className="text-slate-500">Validator Sig:</span> {sealedBlock.sig}
                  </div>
                  <div>
                    <span className="text-slate-500">Transactions ({sealedBlock.txs.length}):</span>{" "}
                    {sealedBlock.txs.join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage 8: Hash Chain */}
          {currentStage === 7 && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                Click any block to simulate unauthorized database mutation and watch subsequent hash pointers break.
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {blocks.map((b, i) => {
                  let isLinkBroken = false;
                  for (let prevIdx = 0; prevIdx < i; prevIdx++) {
                    if (blocks[prevIdx].tampered) {
                      isLinkBroken = true;
                      break;
                    }
                  }

                  const isCompromised = b.tampered || isLinkBroken;

                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleBlockTamper(b.id)}
                      className={`min-w-[140px] p-3 rounded-lg border text-left text-xs transition cursor-pointer ${
                        isCompromised
                          ? "border-red-400 bg-red-50 text-red-900"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{b.label}</span>
                        {isCompromised ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        {b.tampered ? "Hash: TAMPERED" : `Hash: ${hx("blk" + b.id + b.data, 8)}`}
                      </div>
                      <div className="text-[10px] mt-1 font-medium">
                        {b.tampered ? "Directly Altered" : isLinkBroken ? "Link Broken" : "Hash Intact"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setBlocks((prev) => prev.map((b) => ({ ...b, tampered: false })))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Restore Clean Chain
              </button>
            </div>
          )}

          {/* Stage 9: Hierarchy Checkpoints */}
          {currentStage === 8 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { key: "district", label: "District Node", sub: "Checkpoints every 10 min" },
                  { key: "state", label: "State Consensus", sub: "Verifies & checkpoints hourly" },
                  { key: "national", label: "National Archive", sub: "Permanent hash store" }
                ].map((item) => {
                  const state = (nodeHierarchy as any)[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`p-3 rounded-lg border text-xs transition ${
                        state === "lit"
                          ? "border-blue-400 bg-blue-50 text-blue-900"
                          : state === "dead"
                          ? "border-red-400 bg-red-50 text-red-900"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
                      <div className="mt-2 text-[10px] font-mono font-semibold">
                        {state === "lit" ? "SYNCED" : state === "dead" ? "OFFLINE" : "IDLE"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={runSync}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Sync Checkpoints Upward
                </button>
                <button
                  onClick={failDistrict}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 transition"
                >
                  Simulate District Hardware Failure
                </button>
              </div>

              {syncMsg && (
                <div className="p-3 rounded-lg text-xs bg-slate-100 text-slate-800 border border-slate-200">
                  {syncMsg}
                </div>
              )}
            </div>
          )}

          {/* Stage 10: Audit Surveillance */}
          {currentStage === 9 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  "Node offline: state consensus node S-02 delayed response",
                  "Invalid transaction dropped at District D1 (Signature mismatch)",
                  "Checkpoint sync lag: District D14 hash pending national confirmation"
                ].map((alertText, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAuditAlerts((prev) => [alertText, ...prev])}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Simulate Incident {idx + 1}
                  </button>
                ))}
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 min-h-[100px] text-xs">
                <div className="font-semibold text-slate-700 mb-2">Auditor Event Feed:</div>
                {auditAlerts.length === 0 ? (
                  <div className="text-slate-400 italic">No anomaly alerts. System running cleanly.</div>
                ) : (
                  <div className="space-y-1.5">
                    {auditAlerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-red-700 bg-white p-2 rounded border border-red-100">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
            <button
              onClick={() => setCurrentStage((s) => Math.max(0, s - 1))}
              disabled={currentStage === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Stage
            </button>
            <button
              onClick={() => setCurrentStage((s) => Math.min(stagesList.length - 1, s + 1))}
              disabled={currentStage === stagesList.length - 1}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40"
            >
              Next Stage
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
