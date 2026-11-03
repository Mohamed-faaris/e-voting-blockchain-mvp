# Monorepo architecture and migration plan

## Runtime topology
```text
Admin (5173) ─┐
Voter (5174) ─┤
Candidate (5175) ─┼── Hono API (3000) ── current SQLite / Turso adapter
Explorer (5176) ┘
                  Shared UI · Design tokens · API contracts · API client

Optional: Drizzle schema + PostgreSQL client (not wired into API runtime)
```

## Workspaces
- `apps/admin`: operations command center. All previous hash routes and pages remain available.
- `apps/voter`: separate three-stage demo flow using current voter auth and cast endpoints.
- `apps/candidate`: read-only candidate roster, chain integrity and system status. Does not invent or derive tallies.
- `apps/explorer`: block list/detail and receipt lookup using the existing chain endpoints.
- `apps/api`: shared Hono API and current SQLite/Turso adapter.
- `packages/ui`, `design-system`, `contracts`, `api-client`: shared presentation and typed client boundary.
- `packages/database`: PostgreSQL Drizzle schema, client and initial migration.
- `packages/seed`: deterministic synthetic dataset generator for 5,000 records.

## Data migration boundary
The existing SQLite/Turso storage adapter remains the runtime source of truth. PostgreSQL/Drizzle is an opt-in schema foundation and must not become authoritative until:
1. a PostgreSQL storage adapter implements every method in the existing storage interface;
2. adapter parity tests cover token issuance/spending, block append, tamper/reset and voter state;
3. chain hashes, signatures and Merkle roots are verified against identical fixtures;
4. data migration and rollback are tested with backups.

## API and security invariants
- Existing endpoint paths and response shapes remain unchanged.
- Do not expose private validator keys or voter-to-ballot identity mappings to public portals.
- Current demo voting still returns a private session key to the client; this is not a production key-custody design.
- Base64 is encoding, not encryption. District synchronization is simulated, not consensus.
- Candidate tallies must not be inferred from encrypted ballot payloads or exposed without a separately verified tally pipeline.

## Commands
```zsh
pnpm install --no-frozen-lockfile
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```
