# Electronic Voting Blockchain MVP

> **Educational demonstration only. Not suitable for conducting real elections.**

This is a PNPM + Turborepo monorepo with four independent React portals, one shared Hono API, reusable UI/contracts packages and PostgreSQL persistence through Drizzle.

## Applications
| Workspace | Local address | Purpose |
|---|---|---|
| Admin | http://localhost:5173 | Election Command Center; retains every legacy admin route |
| Voter | http://localhost:5174 | Demo voter check-in, token, ballot and receipt |
| Candidate | http://localhost:5175 | Read-only candidate roster and audit metadata |
| Explorer | http://localhost:5176 | Blocks, Merkle roots, chain verification and receipt lookup |
| API | http://localhost:3000 | Shared Hono endpoints and PostgreSQL persistence |

## Run on Ubuntu / zsh
Requirements: Node.js 22+ and PNPM 10+.
```zsh
corepack enable
pnpm install --no-frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm dev
```

Build and verify:
```zsh
pnpm build
pnpm typecheck
pnpm test
```
Run a service separately with `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:voter`, `pnpm dev:candidate` or `pnpm dev:explorer`.

## Database workflow

The API uses PostgreSQL through the shared `@evoting/database` package. Drizzle defines the typed schema and manages database setup; the API storage adapter uses parameterized PostgreSQL queries for the voting and ledger transactions. SQLite/Turso remains only as legacy compatibility/test code and is not selected by the API runtime.

| Command | Purpose |
|---|---|
| `pnpm db:generate` | Generate Drizzle migration files after schema changes |
| `pnpm db:migrate` | Apply the idempotent PostgreSQL schema migration |
| `pnpm db:seed` | Insert the deterministic demo voter baseline without overwriting existing demo voter state |
| `pnpm db:reset` | Destructively clear demo votes, tokens, blocks, and voters, then recreate the voter seed |
| `pnpm db:verify` | Check required tables, seeded voters, ledger links, and token/transaction state |
| `pnpm db:studio` | Open Drizzle Studio |

The deterministic seed creates 5,000 synthetic voters in 12 demo districts: 3,250 initially marked as voted and 1,750 initially not voted. Re-running `db:seed` is safe and does not reset existing voter states. Use `db:reset` only when you intentionally want to discard demo ledger and voting state. After a reset, start or restart the API; it creates a fresh genesis block automatically.

Local PostgreSQL is provided by Docker Compose:
```zsh
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```
The local Docker credentials are development-only. For hosted deployment, configure a managed PostgreSQL provider such as Neon and set `DATABASE_URL` only on the API server.

## Deployment model
The existing root Vercel project remains the API/legacy compatibility deployment. Deploy the four Vite apps as separate Vercel projects from this same repository, using each workspace as its project root: `apps/admin`, `apps/voter`, `apps/candidate` and `apps/explorer`. Keep workspace files available to the build (the workspace packages live outside each app directory). For each frontend deployment, configure:
- `VITE_API_BASE_URL`: absolute origin of the deployed Hono API, e.g. `https://api.example.com`.
- The other `VITE_*_URL` portal variables: deployed URLs for the other three frontends.

On the API deployment, set `ALLOWED_ORIGINS` to a comma-separated list of the four frontend origins. Local development already allows ports 5173–5176. Do not set a wildcard origin when enabling voting POST requests.

## Workspaces
- `apps/api`: Hono API, PostgreSQL runtime adapter and blockchain demo. The legacy SQLite/Turso adapter is retained only for compatibility tests.
- `apps/admin`, `apps/voter`, `apps/candidate`, `apps/explorer`: independent Vite/React apps.
- `packages/ui`: shared shell, page headers, panels, metric cards, status and loading components.
- `packages/design-system`: shared light-theme tokens and responsive shell styles.
- `packages/contracts`: shared API/domain TypeScript contracts.
- `packages/api-client`: typed fetch client for existing routes; supports cross-origin API base configuration.
- `packages/database`: Drizzle schema, PostgreSQL client and migration, seed, reset and verification scripts.
- `packages/seed`: deterministic synthetic voter fixture (5,000 records; 3,250 initially voted and 1,750 initially not voted).

## Existing capabilities retained
SHA-256 hash-linked blocks, Merkle roots, Ed25519 demo signing, check-in/token workflow, ballot casting, receipts, block/chain verification, district synchronization simulation and tamper demonstration remain in the shared API and legacy admin app. The API also exposes a demo `/api/tally` endpoint; the candidate portal currently remains a read-only candidate roster.

## Important security limitations
- Base64 ballot payload representation is **not encryption**.
- The legacy admin page contains hardcoded demonstration credentials.
- The current API returns a demo private session key to the browser and accepts it back on ballot submission.
- District sync is an in-memory simulation, not distributed consensus.
- `/api/tally` is a demonstration endpoint and is not an independently audited election-results process.
- Never use real identities, voter rolls, ballots or election operations.
- This is not a certified or secure election platform.

See [the architecture and migration plan](docs/architecture/monorepo-migration.md).
