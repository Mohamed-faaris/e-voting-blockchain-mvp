CREATE TABLE IF NOT EXISTS voters(voter_id text PRIMARY KEY,name text NOT NULL,district_id text NOT NULL,has_voted boolean NOT NULL DEFAULT false,issued_token_id text);
CREATE INDEX IF NOT EXISTS voters_district_idx ON voters(district_id);
CREATE TABLE IF NOT EXISTS blocks(block_index integer PRIMARY KEY,district_id text NOT NULL,timestamp timestamptz NOT NULL,previous_hash text NOT NULL,merkle_root text NOT NULL,block_hash text NOT NULL UNIQUE,payload_json jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS blocks_district_idx ON blocks(district_id);
CREATE TABLE IF NOT EXISTS transactions(id text PRIMARY KEY,block_index integer NOT NULL REFERENCES blocks(block_index) ON DELETE CASCADE,token_id text NOT NULL,district_id text NOT NULL,payload_json jsonb NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_token_unique ON transactions(token_id);
CREATE INDEX IF NOT EXISTS transactions_block_idx ON transactions(block_index);
CREATE TABLE IF NOT EXISTS voting_tokens(token_id text PRIMARY KEY,voter_id text NOT NULL REFERENCES voters(voter_id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'ACTIVE',created_at timestamptz NOT NULL,spent_at timestamptz);
CREATE INDEX IF NOT EXISTS voting_tokens_voter_idx ON voting_tokens(voter_id);
