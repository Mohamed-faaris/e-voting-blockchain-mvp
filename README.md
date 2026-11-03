# Electronic Voting Blockchain MVP

> **Educational demonstration only. Not suitable for conducting real elections.**

This repository is being migrated to a PNPM + Turborepo monorepo. The current branch, `refactor/turborepo-monorepo`, establishes the workspace foundation while keeping the existing Hono API, React UI and SQLite/Turso storage implementation available during the migration.

## Current capabilities

- SHA-256 hash-linked blocks and Merkle roots
- Chain integrity verification
- Ed25519 transaction/block signing in the demo implementation
- One-time token reference enforcement
- Voter check-in, ballot casting and receipt flow
- District synchronization simulation
- Tamper demonstration
- SQLite/Turso persistence

**Security limitation:** the current demo ballot representation is Base64-encoded data, not ballot encryption. District synchronization is simulated, not distributed consensus. Do not use this project for real elections or real voter data.

## Requirements

- Node.js 20+
- PNPM 10+
- PostgreSQL will be introduced in a later migration phase; the current runtime still uses its existing SQLite/Turso adapter.

## Run on Ubuntu / zsh

```zsh
corepack enable
pnpm install

# Run workspace development tasks (currently the API compatibility workspace)
pnpm dev

# Explicit legacy API command during migration
pnpm dev:legacy

# Run existing tests
pnpm test:legacy

# Type-check the current legacy source
pnpm typecheck:legacy

# Start the existing Vite frontend separately, if needed
pnpm exec vite
```

The first `pnpm install` will reconcile the lockfile with the new root Turborepo dependency and workspace configuration. Commit the generated lockfile update with the migration.

## Workspace structure

```text
apps/
  api/                 # First workspace boundary; currently delegates to legacy src/
packages/              # Shared packages added in subsequent phases
src/                   # Existing implementation retained during safe migration
  blockchain/
  client/
  storage/
  server.ts
docs/
  architecture/
    monorepo-migration.md
```

Target applications:

- `apps/admin` — Election Command Center
- `apps/voter` — Voter Portal
- `apps/explorer` — Blockchain Explorer
- `apps/candidate` — Candidate Portal
- `apps/api` — shared Hono backend

Target shared packages:

- `packages/ui` — shadcn/ui components
- `packages/design-system` — light theme tokens
- `packages/contracts` — shared Zod schemas and types
- `packages/api-client` — typed API client
- `packages/database` — Drizzle ORM, PostgreSQL schema and migrations
- `packages/blockchain` — shared blockchain primitives
- `packages/seed` — deterministic synthetic demo data

See [the migration plan](docs/architecture/monorepo-migration.md) for the staged migration rules and sequence.

## Try the API

```zsh
# Genesis chain
curl http://localhost:3000/chain

# Add a demo transaction. Use a unique tokenId for each accepted vote.
curl -X POST http://localhost:3000/demo/transactions \
  -H 'content-type: application/json' \
  -d '{"districtId":"D1","tokenId":"demo-token-001","encryptedVote":"DEMO-CIPHERTEXT-A"}'

# Verify the chain
curl http://localhost:3000/chain/verify

# Reusing a token should return HTTP 409
curl -i -X POST http://localhost:3000/demo/transactions \
  -H 'content-type: application/json' \
  -d '{"districtId":"D1","tokenId":"demo-token-001","encryptedVote":"DEMO-CIPHERTEXT-B"}'

# Intentionally mutate block 1, then verify integrity failure
curl -X POST http://localhost:3000/demo/tamper/1
curl http://localhost:3000/chain/verify
```

The current database defaults to `./data/voting-demo.sqlite`. Override with `DB_PATH=/path/to/file.sqlite`.

## Migration principles

1. Keep the existing API contracts and voting behavior working while moving files.
2. Introduce PostgreSQL and Drizzle behind a storage boundary; do not remove SQLite until parity tests pass.
3. Keep one shared Hono API and one authoritative database for all four portals.
4. Generate synthetic voter data only. The planned demo dataset is 5,000 voters, with 3,250 voted and 1,750 not voted.
5. Verify that seeded transactions, voter statuses, block hashes, Merkle roots and signatures agree.
6. Never expose private validator keys or voter-to-ballot links through browser-facing APIs.
