import { createDatabase } from "@evoting/database";
import type { Block, Voter, Candidate } from "../blockchain/types.js";
import { createGenesisBlock, createBlock, validateChain, createTransaction } from "../blockchain/chain.js";
import { generateEd25519KeyPair } from "../blockchain/crypto.js";

export const CANDIDATES: Candidate[] = [
  { id: "cand-1", name: "Alice Rivera", party: "Digital Democracy Party", symbol: "DDP" },
  { id: "cand-2", name: "Benjamin Chen", party: "Civic Integrity Alliance", symbol: "CIA" },
  { id: "cand-3", name: "Elena Rostova", party: "Transparency & Progress", symbol: "TPP" }
];

const database = createDatabase();
const { client } = database;

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
      await tx`INSERT INTO voting_tokens (token_id, voter_id, status, created_at) VALUES (${tokenId}, ${voterId}, 'ACTIVE', NOW())`;
      await tx`UPDATE voters SET issued_token_id = ${tokenId} WHERE voter_id = ${voterId}`;
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
  async saveBlock(block: Block): Promise<void> {
    await client.begin(async (tx) => {
      await tx`INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
        VALUES (${block.index}, ${block.districtId}, ${new Date(block.timestamp)}, ${block.previousHash}, ${block.merkleRoot}, ${block.hash}, ${tx.json(block)})`;
      for (const item of block.transactions) {
        await tx`INSERT INTO transactions (id, block_index, token_id, district_id, payload_json)
          VALUES (${item.id}, ${block.index}, ${item.tokenId}, ${item.districtId}, ${tx.json(item)})`;
      }
    });
  },
  async tamperBlock(index: number): Promise<boolean> {
    const rows = await client`SELECT payload_json FROM blocks WHERE block_index = ${index} LIMIT 1`;
    if (!rows[0]) return false;
    const block = rows[0].payload_json as Block;
    block.districtId = `${block.districtId}-TAMPERED`;
    await client`UPDATE blocks SET payload_json = ${client.json(block)} WHERE block_index = ${index}`;
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
  if (voter.issuedTokenId && !(await storage.getActiveToken(voter.issuedTokenId))) return { success: false, message: "Token has already been used or expired." };
  const keyPair = generateEd25519KeyPair();
  const tokenId = `TOKEN-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  await storage.issueToken(voterId, tokenId);
  return { success: true, voter: { ...voter, issuedTokenId: tokenId }, token: { tokenId, publicKey: keyPair.publicKey, privateKey: keyPair.privateKey } };
}
export async function appendDemoTransaction(input: { districtId: string; tokenId: string; encryptedVote: string; privateKey?: string; publicKey?: string }): Promise<Block> {
  await ensureGenesis(input.districtId);
  if (await storage.checkTokenUsed(input.tokenId)) throw new Error("TOKEN_ALREADY_USED");
  const voterId = await storage.findVoterByToken(input.tokenId);
  const chain = await storage.getBlocks();
  const last = chain[chain.length - 1]!;
  const tx = createTransaction(input);
  const block = createBlock(last.index + 1, input.districtId, [tx], last.hash);
  await storage.saveBlock(block);
  await storage.markTokenSpent(input.tokenId, voterId);
  return block;
}
export async function checkChain(): Promise<{ valid: boolean; errors: string[]; blockCount: number }> {
  const chain = await getChain(); return { ...validateChain(chain), blockCount: chain.length };
}
export async function tamperBlockForDemo(index: number): Promise<boolean> { return storage.tamperBlock(index); }
export async function resetDemoData(): Promise<void> { await storage.reset(); await ensureGenesis(); }
