import { createDatabase } from "@evoting/database";
import type { Block, Voter, Candidate } from "../blockchain/types.js";
import { createGenesisBlock, createBlock, validateChain, createTransaction } from "../blockchain/chain.js";
import { generateEd25519KeyPair } from "../blockchain/crypto.js";
import { toPostgresTimestamp } from "./postgres-date.js";

export const CANDIDATES: Candidate[] = [
  { id: "cand-1", name: "Alice Rivera", party: "Digital Democracy Party", symbol: "DDP" },
  { id: "cand-2", name: "Benjamin Chen", party: "Civic Integrity Alliance", symbol: "CIA" },
  { id: "cand-3", name: "Elena Rostova", party: "Transparency & Progress", symbol: "TPP" }
];

const database = createDatabase();
const { client } = database;

/** postgres.js JSON helpers require JSON-compatible values, not domain interfaces. */
function toDatabaseJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Value cannot be serialized as JSON.");
  return serialized;
}

export const storage = {
  async getBlocks(): Promise<Block[]> {
    const rows = await client`SELECT payload_json FROM blocks ORDER BY block_index ASC`;
    return rows.map((row) => row.payload_json as Block);
  },
  async getVoters(): Promise<Voter[]> {
    const rows = await client`SELECT voter_id, name, district_id, has_voted, issued_token_id FROM voters ORDER BY voter_id`;
    return rows.map((r) => ({
      voterId: String(r.voter_id), name: String(r.name), districtId: String(r.district_id),
      hasVoted: Boolean(r.has_voted), issuedTokenId: r.issued_token_id ? String(r.issued_token_id) : undefined
    }));
  },
  async getVoter(voterId: string): Promise<Voter | undefined> {
    const rows = await client`SELECT voter_id, name, district_id, has_voted, issued_token_id FROM voters WHERE voter_id = ${voterId} LIMIT 1`;
    const r = rows[0];
    return r ? { voterId: String(r.voter_id), name: String(r.name), districtId: String(r.district_id), hasVoted: Boolean(r.has_voted), issuedTokenId: r.issued_token_id ? String(r.issued_token_id) : undefined } : undefined;
  },
  async checkTokenUsed(tokenId: string): Promise<boolean> {
    const rows = await client`SELECT 1 FROM transactions WHERE token_id = ${tokenId} LIMIT 1`;
    return rows.length > 0;
  },
  async getActiveToken(tokenId: string): Promise<boolean> {
    const rows = await client`SELECT 1 FROM voting_tokens WHERE token_id = ${tokenId} AND status = 'ACTIVE' LIMIT 1`;
    return rows.length > 0;
  },
  async issueToken(voterId: string, tokenId: string): Promise<void> {
    await client.begin(async (tx) => {
      const voters = await tx`SELECT has_voted FROM voters WHERE voter_id = ${voterId} FOR UPDATE`;
      if (voters.length === 0) throw new Error("VOTER_NOT_FOUND");
      if (Boolean(voters[0].has_voted)) throw new Error("VOTER_ALREADY_VOTED");

      // A voter may have only one active credential. Re-issuing a credential
      // revokes the previous one inside the same transaction.
      await tx`UPDATE voting_tokens SET status = 'REVOKED' WHERE voter_id = ${voterId} AND status = 'ACTIVE'`;
      await tx`INSERT INTO voting_tokens (token_id, voter_id, status, created_at) VALUES (${tokenId}, ${voterId}, 'ACTIVE', NOW())`;
      const updated = await tx`UPDATE voters SET issued_token_id = ${tokenId} WHERE voter_id = ${voterId} AND has_voted = FALSE RETURNING voter_id`;
      if (updated.length !== 1) throw new Error("VOTER_ALREADY_VOTED");
    });
  },
  async markTokenSpent(tokenId: string, voterId?: string): Promise<void> {
    await client.begin(async (tx) => {
      await tx`UPDATE voting_tokens SET status = 'SPENT', spent_at = NOW() WHERE token_id = ${tokenId}`;
      if (voterId) await tx`UPDATE voters SET has_voted = TRUE WHERE voter_id = ${voterId}`;
    });
  },
  async findVoterByToken(tokenId: string): Promise<string | undefined> {
    const rows = await client`SELECT voter_id FROM voting_tokens WHERE token_id = ${tokenId} LIMIT 1`;
    return rows[0]?.voter_id ? String(rows[0].voter_id) : undefined;
  },
  async appendVoteBlock(block: Block, tokenId: string, voterId?: string, requireIssuedToken = false): Promise<void> {
    await client.begin(async (tx) => {
      // Serialize block appends and verify the caller built on the current tip.
      await tx`SELECT pg_advisory_xact_lock(7419202601)`;
      const latest = await tx`SELECT block_index, block_hash FROM blocks ORDER BY block_index DESC LIMIT 1 FOR UPDATE`;
      if (latest.length === 0 || Number(latest[0].block_index) + 1 !== block.index || String(latest[0].block_hash) !== block.previousHash) {
        throw new Error("CHAIN_CONFLICT");
      }

      const tokenRows = await tx`
        SELECT vt.voter_id, vt.status, v.has_voted
        FROM voting_tokens vt
        INNER JOIN voters v ON v.voter_id = vt.voter_id
        WHERE vt.token_id = ${tokenId}
        FOR UPDATE OF vt, v
      `;
      if (tokenRows.length === 0 && requireIssuedToken) throw new Error("TOKEN_INVALID");
      if (tokenRows.length > 0) {
        const token = tokenRows[0];
        if (String(token.status) !== "ACTIVE" || Boolean(token.has_voted)) throw new Error("TOKEN_ALREADY_USED");
        if (voterId && String(token.voter_id) !== voterId) throw new Error("TOKEN_INVALID");
      } else if (voterId) {
        throw new Error("TOKEN_INVALID");
      }

      await tx`INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
        VALUES (${block.index}, ${block.districtId}, ${toPostgresTimestamp(block.timestamp)}, ${block.previousHash}, ${block.merkleRoot}, ${block.hash}, ${toDatabaseJson(block)})`;
      for (const item of block.transactions) {
        await tx`INSERT INTO transactions (id, block_index, token_id, district_id, payload_json)
          VALUES (${item.id}, ${block.index}, ${item.tokenId}, ${item.districtId}, ${toDatabaseJson(item)})`;
      }

      if (tokenRows.length > 0) {
        const actualVoterId = String(tokenRows[0].voter_id);
        const spent = await tx`UPDATE voting_tokens SET status = 'SPENT', spent_at = NOW() WHERE token_id = ${tokenId} AND status = 'ACTIVE' RETURNING token_id`;
        if (spent.length !== 1) throw new Error("TOKEN_ALREADY_USED");
        const marked = await tx`UPDATE voters SET has_voted = TRUE WHERE voter_id = ${actualVoterId} AND has_voted = FALSE RETURNING voter_id`;
        if (marked.length !== 1) throw new Error("TOKEN_ALREADY_USED");
      }
    });
  },
  async saveBlock(block: Block): Promise<void> {
    await client.begin(async (tx) => {
      await tx`INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
        VALUES (${block.index}, ${block.districtId}, ${toPostgresTimestamp(block.timestamp)}, ${block.previousHash}, ${block.merkleRoot}, ${block.hash}, ${toDatabaseJson(block)})`;
      for (const item of block.transactions) {
        await tx`INSERT INTO transactions (id, block_index, token_id, district_id, payload_json)
          VALUES (${item.id}, ${block.index}, ${item.tokenId}, ${item.districtId}, ${toDatabaseJson(item)})`;
      }
    });
  },
  async tamperBlock(index: number): Promise<boolean> {
    const rows = await client`SELECT payload_json FROM blocks WHERE block_index = ${index} LIMIT 1`;
    if (!rows[0]) return false;
    const block = rows[0].payload_json as Block;
    block.districtId = `${block.districtId}-TAMPERED`;
    await client`UPDATE blocks SET payload_json = ${toDatabaseJson(block)} WHERE block_index = ${index}`;
    return true;
  },
  async reset(): Promise<void> {
    await client.begin(async (tx) => {
      await tx`DELETE FROM transactions`;
      await tx`DELETE FROM blocks`;
      await tx`DELETE FROM voting_tokens`;
      await tx`UPDATE voters SET has_voted = FALSE, issued_token_id = NULL`;
    });
  }
};

export async function initStorage(): Promise<void> {
  await client`CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY, name TEXT NOT NULL, district_id TEXT NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE, issued_token_id TEXT
  )`;
  await client`CREATE TABLE IF NOT EXISTS blocks (
    block_index INTEGER PRIMARY KEY, district_id TEXT NOT NULL, timestamp TIMESTAMPTZ NOT NULL,
    previous_hash TEXT NOT NULL, merkle_root TEXT NOT NULL, block_hash TEXT NOT NULL UNIQUE, payload_json JSONB NOT NULL
  )`;
  await client`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, block_index INTEGER NOT NULL REFERENCES blocks(block_index) ON DELETE CASCADE,
    token_id TEXT NOT NULL UNIQUE, district_id TEXT NOT NULL, payload_json JSONB NOT NULL
  )`;
  await client`CREATE TABLE IF NOT EXISTS voting_tokens (
    token_id TEXT PRIMARY KEY, voter_id TEXT NOT NULL REFERENCES voters(voter_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL, spent_at TIMESTAMPTZ
  )`;
  await client`CREATE INDEX IF NOT EXISTS voters_district_idx ON voters(district_id)`;
  await client`CREATE INDEX IF NOT EXISTS blocks_district_idx ON blocks(district_id)`;
  await client`CREATE INDEX IF NOT EXISTS transactions_block_idx ON transactions(block_index)`;
  await client`CREATE INDEX IF NOT EXISTS voting_tokens_voter_idx ON voting_tokens(voter_id)`;
  await ensureGenesis();
}

export async function ensureGenesis(districtId = "DEMO-DISTRICT"): Promise<void> {
  if ((await storage.getBlocks()).length === 0) await storage.saveBlock(createGenesisBlock(districtId));
}
export async function getChain(): Promise<Block[]> { await ensureGenesis(); return storage.getBlocks(); }
export async function getAllVoters(): Promise<Voter[]> { return storage.getVoters(); }
export async function authenticateVoter(voterId: string): Promise<{ success: boolean; message?: string; voter?: Voter; token?: { tokenId: string; publicKey: string; privateKey: string } }> {
  const voter = await storage.getVoter(voterId);
  if (!voter) return { success: false, message: "Voter not registered in voter roll." };
  if (voter.hasVoted) return { success: false, message: "Voter has already cast their ballot." };
  const keyPair = generateEd25519KeyPair();
  const tokenId = `TOKEN-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  try {
    await storage.issueToken(voterId, tokenId);
  } catch (error) {
    if (error instanceof Error && error.message === "VOTER_ALREADY_VOTED") {
      return { success: false, message: "Voter has already cast their ballot." };
    }
    if (error instanceof Error && error.message === "VOTER_NOT_FOUND") {
      return { success: false, message: "Voter not registered in voter roll." };
    }
    throw error;
  }
  return { success: true, voter: { ...voter, issuedTokenId: tokenId }, token: { tokenId, publicKey: keyPair.publicKey, privateKey: keyPair.privateKey } };
}

export async function appendDemoTransaction(input: {
  districtId: string; tokenId: string; encryptedVote: string; privateKey?: string; publicKey?: string;
  requireIssuedToken?: boolean;
}): Promise<Block> {
  await ensureGenesis(input.districtId);
  const voterId = await storage.findVoterByToken(input.tokenId);
  if (input.requireIssuedToken && !voterId) throw new Error("TOKEN_INVALID");

  // Retry a stale chain tip if another voter's transaction commits between
  // reading the current tip and taking the append lock.
  for (let attempt = 0; attempt < 3; attempt++) {
    const chain = await storage.getBlocks();
    const last = chain[chain.length - 1]!;
    const tx = createTransaction(input);
    const block = createBlock(last.index + 1, input.districtId, [tx], last.hash);
    try {
      await storage.appendVoteBlock(block, input.tokenId, voterId, Boolean(input.requireIssuedToken));
      return block;
    } catch (error) {
      if (error instanceof Error && error.message === "CHAIN_CONFLICT" && attempt < 2) continue;
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new Error("TOKEN_ALREADY_USED");
      }
      throw error;
    }
  }
  throw new Error("CHAIN_CONFLICT");
}

export async function checkChain(): Promise<{ valid: boolean; errors: string[]; blockCount: number }> {
  const chain = await getChain(); return { ...validateChain(chain), blockCount: chain.length };
}
export async function tamperBlockForDemo(index: number): Promise<boolean> { return storage.tamperBlock(index); }
export async function resetDemoData(): Promise<void> { await storage.reset(); await ensureGenesis(); }
