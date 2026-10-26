import { createClient, type Client } from "@libsql/client";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Block, VoteTransaction, Voter, Candidate } from "../blockchain/types.js";
import { createGenesisBlock, createBlock, validateChain, createTransaction } from "../blockchain/chain.js";
import { generateEd25519KeyPair } from "../blockchain/crypto.js";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

export const CANDIDATES: Candidate[] = [
  { id: "cand-1", name: "Alice Rivera", party: "Digital Democracy Party", symbol: "DDP" },
  { id: "cand-2", name: "Benjamin Chen", party: "Civic Integrity Alliance", symbol: "CIA" },
  { id: "cand-3", name: "Elena Rostova", party: "Transparency & Progress", symbol: "TPP" }
];

const INIT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS blocks (
    block_index INTEGER PRIMARY KEY,
    district_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    merkle_root TEXT NOT NULL,
    block_hash TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    block_index INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    district_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY(block_index) REFERENCES blocks(block_index)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS unique_token_reference ON transactions(token_id);

  CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district_id TEXT NOT NULL,
    has_voted INTEGER DEFAULT 0,
    issued_token_id TEXT
  );

  CREATE TABLE IF NOT EXISTS voting_tokens (
    token_id TEXT PRIMARY KEY,
    voter_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL,
    spent_at TEXT
  );
`;

const INITIAL_VOTERS = [
  ["VOTER-101", "Amara Okafor", "D1"],
  ["VOTER-102", "Devon Vance", "D1"],
  ["VOTER-103", "Priya Sharma", "D1"],
  ["VOTER-104", "Lucas Silva", "D2"],
  ["VOTER-105", "Fatima Al-Mansoor", "D2"]
];

interface StorageAdapter {
  isAsync: boolean;
  init(): Promise<void> | void;
  getBlocks(): Promise<Block[]> | Block[];
  saveBlock(block: Block): Promise<void> | void;
  getVoters(): Promise<Voter[]> | Voter[];
  getVoter(voterId: string): Promise<Voter | undefined> | Voter | undefined;
  checkTokenUsed(tokenId: string): Promise<boolean> | boolean;
  getActiveToken(tokenId: string): Promise<boolean> | boolean;
  issueToken(voterId: string, tokenId: string): Promise<void> | void;
  markTokenSpent(tokenId: string, voterId?: string): Promise<void> | void;
  findVoterByToken(tokenId: string): Promise<string | undefined> | string | undefined;
  tamperBlock(index: number): Promise<boolean> | boolean;
  reset(): Promise<void> | void;
}

// LibSQL (Turso Cloud) Adapter
class TursoAdapter implements StorageAdapter {
  isAsync = true;
  private client: Client;

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken });
  }

  async init() {
    const statements = INIT_SCHEMA_SQL.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await this.client.execute(stmt);
    }

    const countRes = await this.client.execute("SELECT count(*) as cnt FROM voters");
    const count = Number(countRes.rows[0]?.cnt ?? 0);
    if (count === 0) {
      for (const [id, name, district] of INITIAL_VOTERS) {
        await this.client.execute({
          sql: "INSERT INTO voters (voter_id, name, district_id) VALUES (?, ?, ?)",
          args: [id, name, district]
        });
      }
    }
  }

  async getBlocks(): Promise<Block[]> {
    const res = await this.client.execute("SELECT payload_json FROM blocks ORDER BY block_index ASC");
    return res.rows.map((row) => JSON.parse(row.payload_json as string) as Block);
  }

  async saveBlock(block: Block): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [block.index, block.districtId, block.timestamp, block.previousHash, block.merkleRoot, block.hash, JSON.stringify(block)]
    });
    for (const tx of block.transactions) {
      await this.client.execute({
        sql: `INSERT INTO transactions (id, block_index, token_id, district_id, payload_json)
              VALUES (?, ?, ?, ?, ?)`,
        args: [tx.id, block.index, tx.tokenId, tx.districtId, JSON.stringify(tx)]
      });
    }
  }

  async getVoters(): Promise<Voter[]> {
    const res = await this.client.execute("SELECT voter_id, name, district_id, has_voted, issued_token_id FROM voters");
    return res.rows.map((r) => ({
      voterId: String(r.voter_id),
      name: String(r.name),
      districtId: String(r.district_id),
      hasVoted: Boolean(r.has_voted),
      issuedTokenId: r.issued_token_id ? String(r.issued_token_id) : undefined
    }));
  }

  async getVoter(voterId: string): Promise<Voter | undefined> {
    const res = await this.client.execute({
      sql: "SELECT * FROM voters WHERE voter_id = ?",
      args: [voterId]
    });
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      voterId: String(r.voter_id),
      name: String(r.name),
      districtId: String(r.district_id),
      hasVoted: Boolean(r.has_voted),
      issuedTokenId: r.issued_token_id ? String(r.issued_token_id) : undefined
    };
  }

  async checkTokenUsed(tokenId: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: "SELECT 1 FROM transactions WHERE token_id = ?",
      args: [tokenId]
    });
    return res.rows.length > 0;
  }

  async getActiveToken(tokenId: string): Promise<boolean> {
    const res = await this.client.execute({
      sql: "SELECT 1 FROM voting_tokens WHERE token_id = ? AND status = 'ACTIVE'",
      args: [tokenId]
    });
    return res.rows.length > 0;
  }

  async issueToken(voterId: string, tokenId: string): Promise<void> {
    await this.client.execute({
      sql: "INSERT INTO voting_tokens (token_id, voter_id, status, created_at) VALUES (?, ?, 'ACTIVE', ?)",
      args: [tokenId, voterId, new Date().toISOString()]
    });
    await this.client.execute({
      sql: "UPDATE voters SET issued_token_id = ? WHERE voter_id = ?",
      args: [tokenId, voterId]
    });
  }

  async findVoterByToken(tokenId: string): Promise<string | undefined> {
    const res = await this.client.execute({
      sql: "SELECT voter_id FROM voting_tokens WHERE token_id = ?",
      args: [tokenId]
    });
    return res.rows[0]?.voter_id ? String(res.rows[0].voter_id) : undefined;
  }

  async markTokenSpent(tokenId: string, voterId?: string): Promise<void> {
    await this.client.execute({
      sql: "UPDATE voting_tokens SET status = 'SPENT', spent_at = ? WHERE token_id = ?",
      args: [new Date().toISOString(), tokenId]
    });
    if (voterId) {
      await this.client.execute({
        sql: "UPDATE voters SET has_voted = 1 WHERE voter_id = ?",
        args: [voterId]
      });
    }
  }

  async tamperBlock(index: number): Promise<boolean> {
    const res = await this.client.execute({
      sql: "SELECT payload_json FROM blocks WHERE block_index = ?",
      args: [index]
    });
    if (res.rows.length === 0) return false;
    const block = JSON.parse(res.rows[0].payload_json as string) as Block;
    block.districtId = `${block.districtId}-TAMPERED`;
    await this.client.execute({
      sql: "UPDATE blocks SET payload_json = ? WHERE block_index = ?",
      args: [JSON.stringify(block), index]
    });
    return true;
  }

  async reset(): Promise<void> {
    await this.client.execute("DELETE FROM transactions");
    await this.client.execute("DELETE FROM blocks");
    await this.client.execute("DELETE FROM voting_tokens");
    await this.client.execute("UPDATE voters SET has_voted = 0, issued_token_id = NULL");
  }
}

// Local SQLite Adapter (Fallback & Fast Tests)
class LocalSqliteAdapter implements StorageAdapter {
  isAsync = false;
  private db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  init() {
    this.db.exec(INIT_SCHEMA_SQL);
    const count = (this.db.prepare("SELECT count(*) as cnt FROM voters").get() as unknown as { cnt: number }).cnt;
    if (count === 0) {
      const insert = this.db.prepare("INSERT INTO voters (voter_id, name, district_id) VALUES (?, ?, ?)");
      for (const [id, name, district] of INITIAL_VOTERS) {
        insert.run(id, name, district);
      }
    }
  }

  getBlocks(): Block[] {
    const rows = this.db.prepare("SELECT payload_json FROM blocks ORDER BY block_index ASC").all() as unknown as { payload_json: string }[];
    return rows.map((row) => JSON.parse(row.payload_json) as Block);
  }

  saveBlock(block: Block): void {
    const insertBlock = this.db.prepare(`
      INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTx = this.db.prepare(`
      INSERT INTO transactions (id, block_index, token_id, district_id, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.db.exec("BEGIN TRANSACTION;");
    try {
      insertBlock.run(block.index, block.districtId, block.timestamp, block.previousHash, block.merkleRoot, block.hash, JSON.stringify(block));
      for (const tx of block.transactions) {
        insertTx.run(tx.id, block.index, tx.tokenId, tx.districtId, JSON.stringify(tx));
      }
      this.db.exec("COMMIT;");
    } catch (e) {
      this.db.exec("ROLLBACK;");
      throw e;
    }
  }

  getVoters(): Voter[] {
    const rows = this.db.prepare("SELECT voter_id, name, district_id, has_voted, issued_token_id FROM voters").all() as unknown as {
      voter_id: string; name: string; district_id: string; has_voted: number; issued_token_id: string | null;
    }[];
    return rows.map((r) => ({
      voterId: r.voter_id,
      name: r.name,
      districtId: r.district_id,
      hasVoted: Boolean(r.has_voted),
      issuedTokenId: r.issued_token_id ?? undefined
    }));
  }

  getVoter(voterId: string): Voter | undefined {
    const row = this.db.prepare("SELECT * FROM voters WHERE voter_id = ?").get(voterId) as unknown as {
      voter_id: string; name: string; district_id: string; has_voted: number; issued_token_id: string | null;
    } | undefined;
    if (!row) return undefined;
    return {
      voterId: row.voter_id,
      name: row.name,
      districtId: row.district_id,
      hasVoted: Boolean(row.has_voted),
      issuedTokenId: row.issued_token_id ?? undefined
    };
  }

  checkTokenUsed(tokenId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM transactions WHERE token_id = ?").get(tokenId));
  }

  getActiveToken(tokenId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM voting_tokens WHERE token_id = ? AND status = 'ACTIVE'").get(tokenId));
  }

  issueToken(voterId: string, tokenId: string): void {
    this.db.prepare("INSERT INTO voting_tokens (token_id, voter_id, status, created_at) VALUES (?, ?, 'ACTIVE', ?)").run(
      tokenId, voterId, new Date().toISOString()
    );
    this.db.prepare("UPDATE voters SET issued_token_id = ? WHERE voter_id = ?").run(tokenId, voterId);
  }

  findVoterByToken(tokenId: string): string | undefined {
    const row = this.db.prepare("SELECT voter_id FROM voting_tokens WHERE token_id = ?").get(tokenId) as unknown as { voter_id: string } | undefined;
    return row?.voter_id;
  }

  markTokenSpent(tokenId: string, voterId?: string): void {
    this.db.prepare("UPDATE voting_tokens SET status = 'SPENT', spent_at = ? WHERE token_id = ?").run(
      new Date().toISOString(), tokenId
    );
    if (voterId) {
      this.db.prepare("UPDATE voters SET has_voted = 1 WHERE voter_id = ?").run(voterId);
    }
  }

  tamperBlock(index: number): boolean {
    const row = this.db.prepare("SELECT payload_json FROM blocks WHERE block_index = ?").get(index) as unknown as { payload_json: string } | undefined;
    if (!row) return false;
    const block = JSON.parse(row.payload_json) as Block;
    block.districtId = `${block.districtId}-TAMPERED`;
    this.db.prepare("UPDATE blocks SET payload_json = ? WHERE block_index = ?").run(JSON.stringify(block), index);
    return true;
  }

  reset(): void {
    this.db.exec("DELETE FROM transactions;");
    this.db.exec("DELETE FROM blocks;");
    this.db.exec("DELETE FROM voting_tokens;");
    this.db.exec("UPDATE voters SET has_voted = 0, issued_token_id = NULL;");
  }
}

// Instantiate storage based on environment
export const storage: StorageAdapter = (tursoUrl)
  ? new TursoAdapter(tursoUrl, tursoAuthToken)
  : new LocalSqliteAdapter(resolve(process.env.DB_PATH ?? "./data/voting-demo.sqlite"));

export async function initStorage(): Promise<void> {
  await storage.init();
  await ensureGenesis();
}

export async function ensureGenesis(districtId = "DEMO-DISTRICT"): Promise<void> {
  const blocks = await storage.getBlocks();
  if (blocks.length === 0) {
    await storage.saveBlock(createGenesisBlock(districtId));
  }
}

export async function getChain(): Promise<Block[]> {
  await ensureGenesis();
  return await storage.getBlocks();
}

export async function getAllVoters(): Promise<Voter[]> {
  return await storage.getVoters();
}

export async function authenticateVoter(voterId: string): Promise<{
  success: boolean;
  message?: string;
  voter?: Voter;
  token?: { tokenId: string; publicKey: string; privateKey: string };
}> {
  const voter = await storage.getVoter(voterId);
  if (!voter) {
    return { success: false, message: "Voter not registered in voter roll." };
  }
  if (voter.hasVoted) {
    return { success: false, message: "Voter has already cast their ballot." };
  }
  if (voter.issuedTokenId) {
    const isActive = await storage.getActiveToken(voter.issuedTokenId);
    if (!isActive) {
      return { success: false, message: "Token has already been used or expired." };
    }
  }

  const keyPair = generateEd25519KeyPair();
  const tokenId = `TOKEN-${globalThis.crypto.randomUUID().slice(0, 8)}`;

  await storage.issueToken(voterId, tokenId);

  return {
    success: true,
    voter: {
      voterId: voter.voterId,
      name: voter.name,
      districtId: voter.districtId,
      hasVoted: false,
      issuedTokenId: tokenId
    },
    token: {
      tokenId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    }
  };
}

export async function appendDemoTransaction(input: {
  districtId: string;
  tokenId: string;
  encryptedVote: string;
  privateKey?: string;
  publicKey?: string;
}): Promise<Block> {
  await ensureGenesis(input.districtId);
  const chain = await storage.getBlocks();
  const last = chain[chain.length - 1]!;

  if (await storage.checkTokenUsed(input.tokenId)) {
    throw new Error("TOKEN_ALREADY_USED");
  }

  const voterId = await storage.findVoterByToken(input.tokenId);

  const tx = createTransaction({
    districtId: input.districtId,
    tokenId: input.tokenId,
    encryptedVote: input.encryptedVote,
    privateKey: input.privateKey,
    publicKey: input.publicKey
  });

  const block = createBlock(last.index + 1, input.districtId, [tx], last.hash);
  await storage.saveBlock(block);

  await storage.markTokenSpent(input.tokenId, voterId);

  return block;
}

export async function checkChain(): Promise<{ valid: boolean; errors: string[]; blockCount: number }> {
  const chain = await getChain();
  const result = validateChain(chain);
  return { ...result, blockCount: chain.length };
}

export async function tamperBlockForDemo(index: number): Promise<boolean> {
  return await storage.tamperBlock(index);
}

export async function resetDemoData(): Promise<void> {
  await storage.reset();
  await ensureGenesis("DEMO-DISTRICT");
}
