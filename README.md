# Electronic Voting Blockchain MVP

> **Educational demonstration only. Not suitable for conducting real elections.**

This repository uses a PNPM + Turborepo monorepo. The existing React UI and Hono API have been separated into independent workspaces while retaining the current API routes and voting demo flow.

## Current capabilities

- SHA-256 hash-linked blocks and Merkle roots
- Chain integrity verification
- Ed25519 signing in the demo implementation
- One-time token reference enforcement
- Voter check-in, ballot casting and receipt flow
- District synchronization simulation
- Tamper demonstration
- SQLite/Turso persistence

**Security limitation:** the current demo ballot representation is Base64-encoded data, not ballot encryption. District synchronization is simulated, not distributed consensus. Do not use this project for real elections or real voter data.

## Requirements

- Node.js 22+ (the storage adapter uses `node:sqlite`)
- PNPM 10+

## Run on Ubuntu / zsh

```zsh
corepack enable
pnpm install

# Start API and admin frontend together
pnpm dev

# Build both workspaces
pnpm build

# Run backend tests
pnpm test
```

The admin frontend runs on `http://localhost:5173`; the Hono API runs on `http://localhost:3000`. Vite proxies API, chain and demo requests to the backend.

Run each workspace independently:

```zsh
pnpm --filter @evoting/api dev
pnpm --filter @evoting/admin dev
pnpm --filter @evoting/api test
```

The API defaults to `../../data/voting-demo.sqlite` when launched through its workspace script. The existing Turso environment variables remain supported.

## Workspace structure

```text
apps/
  api/
    src/
      blockchain/
      storage/
      server.ts
  admin/
    src/
      components/
      pages/
      App.tsx
      main.tsx
    public/models/
packages/              # shared packages added in subsequent phases
api/index.ts           # Vercel Hono adapter
docs/architecture/
```

Target applications:

- `apps/admin` — Election Command Center
- `apps/voter` — Voter Portal
- `apps/explorer` — Blockchain Explorer
- `apps/candidate` — Candidate Portal
- `apps/api` — shared Hono backend

Target shared packages:

- `packages/ui` — shared UI primitives
- `packages/design-system` — light theme tokens
- `packages/contracts` — shared schemas and API types
- `packages/api-client` — typed API client
- `packages/database` — Drizzle ORM, PostgreSQL schema and migrations
- `packages/blockchain` — shared blockchain primitives
- `packages/seed` — deterministic synthetic demo data

See [the migration plan](docs/architecture/monorepo-migration.md).

## Try the API

```zsh
curl http://localhost:3000/chain
curl http://localhost:3000/chain/verify
curl http://localhost:3000/api/health
```

The database defaults to `./data/voting-demo.sqlite` from the repository root when configured manually. The API workspace scripts set `DB_PATH=../../data/voting-demo.sqlite`.

## Migration principles

1. Keep existing API contracts and voting behavior working.
2. Introduce PostgreSQL and Drizzle behind a storage boundary; do not remove SQLite until parity tests pass.
3. Keep one shared Hono API and one authoritative database for all portals.
4. Generate synthetic voter data only. Planned demo dataset: 5,000 voters, 3,250 voted and 1,750 not voted.
5. Verify seeded transactions, voter statuses, block hashes, Merkle roots and signatures.
6. Never expose private validator keys or voter-to-ballot links through browser-facing APIs.
