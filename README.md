# Electronic Voting Blockchain MVP

> **Educational demonstration only. Not suitable for conducting real elections.**

This is a PNPM + Turborepo monorepo with four independent React portals, one shared Hono API, reusable UI/contracts packages and an opt-in PostgreSQL/Drizzle schema foundation.

## Applications
| Workspace | Local address | Purpose |
|---|---|---|
| Admin | http://localhost:5173 | Election Command Center; retains every legacy admin route |
| Voter | http://localhost:5174 | Demo voter check-in, token, ballot and receipt |
| Candidate | http://localhost:5175 | Read-only candidate roster and audit metadata |
| Explorer | http://localhost:5176 | Blocks, Merkle roots, chain verification and receipt lookup |
| API | http://localhost:3000 | Shared Hono endpoints and current persistence layer |

## Run on Ubuntu / zsh
Requirements: Node.js 22+ and PNPM 10+.
```zsh
corepack enable
pnpm install --no-frozen-lockfile # regenerate the workspace lockfile on this branch
pnpm dev
```
In another terminal, open the portal URLs above. Build and verify:
```zsh
pnpm build
pnpm typecheck
pnpm test
```
Run a service separately with `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:voter`, `pnpm dev:candidate` or `pnpm dev:explorer`.

## PostgreSQL schema (opt-in)
The active API still uses SQLite/Turso. To inspect and migrate the PostgreSQL schema without switching API storage:
```zsh
cp .env.example .env
docker compose -f infra/postgres/compose.yml up -d
# DATABASE_URL must be exported in the current shell if it is not loaded by your shell tooling
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/evoting_demo'
pnpm db:generate
pnpm db:migrate
```
The Drizzle package defines voters, blocks, transactions and voting tokens. Do not route production writes to PostgreSQL until a matching storage adapter and parity tests cover token lifecycle, atomic block append, chain hashes, Merkle roots, signatures, tampering and reset/rollback.

## Workspaces
- `apps/api`: Hono API, current SQLite/Turso adapter and blockchain demo.
- `apps/admin`, `apps/voter`, `apps/candidate`, `apps/explorer`: independent Vite/React apps.
- `packages/ui`: shared shell, page headers, panels, metric cards, status and loading components.
- `packages/design-system`: shared light-theme tokens and responsive shell styles.
- `packages/contracts`: shared API/domain TypeScript contracts.
- `packages/api-client`: typed fetch client for existing routes.
- `packages/database`: Drizzle schema, PostgreSQL client and migration.
- `packages/seed`: deterministic synthetic voter fixture (5,000 records; 3,250 voted and 1,750 not voted).

## Existing capabilities retained
SHA-256 hash-linked blocks, Merkle roots, Ed25519 demo signing, check-in/token workflow, ballot casting, receipts, block/chain verification, district synchronization simulation and tamper demonstration remain in the shared API and legacy admin app.

## Important security limitations
- Base64 ballot payload representation is **not encryption**.
- The legacy admin page contains hardcoded demonstration credentials.
- The current API returns a demo private session key to the browser and accepts it back on ballot submission.
- District synchronization is an in-memory simulation, not distributed consensus.
- Candidate tallies are not published by the current API; the new candidate portal does not infer totals from ballot payloads.
- Never use real identities, voter rolls, ballots or election operations.
- This is not a certified or secure election platform.

See [the architecture and migration plan](docs/architecture/monorepo-migration.md).
