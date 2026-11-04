import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Fingerprint, Vote, CheckCircle2, ArrowRight, RotateCcw, Users } from "lucide-react";
import { api } from "@evoting/api-client";
import type { Candidate, Voter, VoterAuthResponse, VoteReceipt } from "@evoting/contracts";
import { ErrorNotice, PageHeader, Panel, StatusPill, WorkspaceShell } from "@evoting/ui";

const portals = [
  ["Admin", import.meta.env.VITE_ADMIN_URL || "http://localhost:5173"],
  ["Candidate", import.meta.env.VITE_CANDIDATE_URL || "http://localhost:5175"],
  ["Explorer", import.meta.env.VITE_EXPLORER_URL || "http://localhost:5176"]
];

export function App() {
  const [voterId, setVoterId] = useState("");
  const [availableVoters, setAvailableVoters] = useState<Voter[]>([]);
  const [session, setSession] = useState<VoterAuthResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.candidates().then((data) => setCandidates(data.candidates)).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not load candidates.");
    });

    api.voters().then(({ voters }) => {
      const unvotedDemoVoters = voters
        .filter((voter) => voter.voterId.startsWith("DEMO-") && !voter.hasVoted)
        .sort((a, b) => a.voterId.localeCompare(b.voterId, undefined, { numeric: true }));
      setAvailableVoters(unvotedDemoVoters);
      setVoterId((current) => current || unvotedDemoVoters[0]?.voterId || "");
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not load demo voter accounts.");
    });
  }, []);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.authenticateVoter(voterId.trim());
      setSession(result);
      setReceipt(null);
      setCandidateId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function castVote() {
    if (!session || !candidateId) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.castVote({
        districtId: session.voter.districtId,
        tokenId: session.token.tokenId,
        candidateId,
        publicKey: session.token.publicKey,
        privateKey: session.token.privateKey
      });
      setReceipt(result.receipt);
      setAvailableVoters((current) => current.filter((voter) => voter.voterId !== session.voter.voterId));
      setSession(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record ballot");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSession(null);
    setReceipt(null);
    setCandidateId("");
    setVoterId(availableVoters[0]?.voterId ?? "");
    setError("");
  }

  const quickPickVoters = availableVoters.slice(0, 6);

  return (
    <WorkspaceShell
      brand="Civic Ledger"
      tagline="Voter access"
      activePath="voter"
      navItems={[]}
      onNavigate={() => undefined}
      topbarExtra={
        <div className="ev-row">
          {portals.map(([label, url]) => (
            <a key={label} href={url} className="ev-button secondary">{label}</a>
          ))}
        </div>
      }
    >
      <PageHeader
        eyebrow="Voter portal"
        title="Cast your ballot"
        description="A guided demonstration flow: identity check-in, candidate selection and receipt."
      />
      <div className="voter-wrap">
        <div className="voter-step">
          <span className={!session && !receipt ? "active" : ""}>01 · Check in</span>
          <span className={session ? "active" : ""}>02 · Select</span>
          <span className={receipt ? "active" : ""}>03 · Receipt</span>
        </div>

        <div className="ev-alert">
          Demonstration only. Use seeded demo voter IDs; do not enter personal or real electoral data.
          The prototype issues demo credentials to the browser session.
        </div>

        {error && <ErrorNotice>{error}</ErrorNotice>}

        {!session && !receipt && (
          <Panel
            title="Voter identity check-in"
            description="Choose an unvoted demo account or enter its voter ID manually."
          >
            <div className="voter-demo-roster">
              <div className="voter-demo-roster-heading">
                <div>
                  <div className="voter-demo-title"><Users size={16} /> Available demo voters</div>
                  <p className="ev-muted">Select an account to load its voter ID.</p>
                </div>
                <StatusPill tone="success">{availableVoters.length.toLocaleString()} unvoted</StatusPill>
              </div>

              {quickPickVoters.length > 0 ? (
                <div className="voter-demo-list">
                  {quickPickVoters.map((voter) => (
                    <button
                      key={voter.voterId}
                      type="button"
                      className={voterId === voter.voterId ? "voter-demo-account selected" : "voter-demo-account"}
                      onClick={() => {
                        setVoterId(voter.voterId);
                        setError("");
                      }}
                    >
                      <span className="voter-demo-account-main">
                        <strong>{voter.name}</strong>
                        <small>{voter.voterId} · {voter.districtId}</small>
                      </span>
                      <span className="voter-demo-account-status">Not voted</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ev-muted">No unvoted demo accounts are currently available. Run the database seed command to restore the demo roster.</p>
              )}
            </div>

            <form onSubmit={authenticate} className="ev-stack">
              <label className="ev-stack">
                <span className="ev-metric-label">Demo voter ID</span>
                <input
                  className="ev-input"
                  value={voterId}
                  onChange={(event) => setVoterId(event.target.value)}
                  placeholder="DEMO-03251"
                  required
                />
              </label>
              <button className="ev-button" disabled={loading || !voterId.trim()}>
                <Fingerprint size={16} />
                {loading ? "Checking…" : "Verify identity"}
                <ArrowRight size={15} />
              </button>
            </form>
          </Panel>
        )}

        {session && !receipt && (
          <Panel
            title="Select your candidate"
            description={`Authenticated as ${session.voter.name} · ${session.voter.districtId}`}
            action={<StatusPill tone="success">Token issued</StatusPill>}
          >
            <div className="ev-alert">
              Session token: <span className="ev-mono">{session.token.tokenId}</span>. Single-use demo credential.
            </div>
            <div className="ev-stack">
              {candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className="ev-row"
                  style={{ padding: 14, border: "1px solid var(--ev-border)", borderRadius: 12, cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="candidate"
                    checked={candidateId === candidate.id}
                    onChange={() => setCandidateId(candidate.id)}
                  />
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 13 }}>{candidate.name}</strong>
                    <small className="ev-muted">{candidate.party}</small>
                  </span>
                  <StatusPill>{candidate.symbol}</StatusPill>
                </label>
              ))}
            </div>
            <button className="ev-button" onClick={castVote} disabled={loading || !candidateId}>
              <Vote size={16} />
              {loading ? "Recording ballot…" : "Confirm demo ballot"}
            </button>
          </Panel>
        )}

        {receipt && (
          <Panel
            title="Ballot receipt"
            description="Block and transaction references returned by the API."
            action={<StatusPill tone="success">Recorded</StatusPill>}
          >
            <div className="ev-row">
              <CheckCircle2 color="var(--ev-success)" />
              <strong>Ballot recorded in block #{receipt.blockIndex}</strong>
            </div>
            <div className="ev-stack">
              <div>
                <div className="ev-metric-label">Block hash</div>
                <div className="ev-mono">{receipt.blockHash}</div>
              </div>
              <div>
                <div className="ev-metric-label">Transaction ID</div>
                <div className="ev-mono">{receipt.transactionId}</div>
              </div>
              <div>
                <div className="ev-metric-label">Timestamp</div>
                {new Date(receipt.timestamp).toLocaleString()}
              </div>
            </div>
            <button className="ev-button secondary" onClick={reset}>
              <RotateCcw size={15} /> Start next demo session
            </button>
          </Panel>
        )}
      </div>
    </WorkspaceShell>
  );
}
