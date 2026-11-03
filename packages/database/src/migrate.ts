import { createDatabase } from "./index.js";

const { client } = createDatabase();
const statements = [
  `CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district_id TEXT NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    issued_token_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS voters_district_idx ON voters(district_id)`,
  `CREATE TABLE IF NOT EXISTS blocks (
    block_index INTEGER PRIMARY KEY,
    district_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    previous_hash TEXT NOT NULL,
    merkle_root TEXT NOT NULL,
    block_hash TEXT NOT NULL UNIQUE,
    payload_json JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS blocks_district_idx ON blocks(district_id)`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    block_index INTEGER NOT NULL REFERENCES blocks(block_index) ON DELETE CASCADE,
    token_id TEXT NOT NULL UNIQUE,
    district_id TEXT NOT NULL,
    payload_json JSONB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS transactions_block_idx ON transactions(block_index)`,
  `CREATE TABLE IF NOT EXISTS voting_tokens (
    token_id TEXT PRIMARY KEY,
    voter_id TEXT NOT NULL REFERENCES voters(voter_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL,
    spent_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS voting_tokens_voter_idx ON voting_tokens(voter_id)`
];

try {
  await client.begin(async (tx) => {
    for (const statement of statements) await tx.unsafe(statement);
    await tx`CREATE TABLE IF NOT EXISTS _evoting_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await tx`INSERT INTO _evoting_migrations (id) VALUES ('0001_initial_postgresql') ON CONFLICT (id) DO NOTHING`;
  });
  console.log("PostgreSQL schema is up to date.");
} finally {
  await client.end();
}
