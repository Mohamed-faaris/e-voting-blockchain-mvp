import type { Block, VoteTransaction } from "./blockchain/types.js";
import { createBlock } from "./blockchain/chain.js";
import { demoEncryptBallot } from "./blockchain/crypto.js";

export interface DemoVoterForLedger { voterId: string; districtId: string; }
const CANDIDATE_IDS = ["cand-1", "cand-2", "cand-3"] as const;

export function buildDemoLedgerBlocks(
  voters: DemoVoterForLedger[], firstBlockIndex: number, previousHash: string, startTimestamp: string
): Block[] {
  const districts = new Map<string, DemoVoterForLedger[]>();
  for (const voter of voters) {
    const group = districts.get(voter.districtId) ?? [];
    group.push(voter);
    districts.set(voter.districtId, group);
  }

  let blockIndex = firstBlockIndex;
  let previousBlockHash = previousHash;
  const startMs = Date.parse(startTimestamp);
  if (!Number.isFinite(startMs)) throw new Error("Invalid demo ledger seed timestamp.");

  const result: Block[] = [];
  for (const districtId of [...districts.keys()].sort()) {
    const districtVoters = districts.get(districtId)!;
    const transactions: VoteTransaction[] = districtVoters.map((voter) => {
      const voterNumber = Number(voter.voterId.replace(/^DEMO-/, ""));
      if (!Number.isSafeInteger(voterNumber) || voterNumber < 1) throw new Error(`Invalid demo voter ID: ${voter.voterId}`);
      const tokenId = `DEMO-TOKEN-${String(voterNumber).padStart(5, "0")}`;
      const candidateId = CANDIDATE_IDS[(voterNumber - 1) % CANDIDATE_IDS.length];
      const createdAtMs = startMs + voterNumber * 1_000;
      return {
        id: `DEMO-TX-${String(voterNumber).padStart(5, "0")}`,
        districtId,
        tokenId,
        encryptedVote: demoEncryptBallot(candidateId, tokenId, createdAtMs),
        createdAt: new Date(createdAtMs).toISOString()
      };
    });
    // Keep block timestamps later than every synthetic transaction timestamp.
    const timestamp = new Date(startMs + (3_250 + result.length + 1) * 60_000).toISOString();
    const block = createBlock(blockIndex, districtId, transactions, previousBlockHash, undefined, undefined, timestamp);
    result.push(block);
    previousBlockHash = block.hash;
    blockIndex++;
  }
  return result;
}
