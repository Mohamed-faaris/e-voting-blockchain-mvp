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
| API | http://localhost:3000 | Shared Hono endpoints and current persistence layer |

## Run on Ubuntu / zsh
Requirements: Node.js 22+ and PNPM 10+.
```zsh
corepack enable
pnpm install --no-frozen-lockfile # regenerate the workspace lockfile on this branch
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```
Build and verify:
```zsh
pnpm build
pnpm typecheck
pnpm test
```
Run a service separately with `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:voter`, `pnpm dev:candidate` or `pnpm dev:explorer`.

## Deployment model
The existing root Vercel project remains the API/legacy compatibility deployment. Deploy the four Vite apps as separate Vercel projects from this same repository, using each workspace as its project root: `apps/admin`, `apps/voter`, `apps/candidate` and `apps/explorer`. Keep workspace files available to the build (the workspace packages live outside each app directory). For each frontend deployment, configure:
- `VITE_API_BASE_URL`: absolute origin of the deployed Hono API, e.g. `https://api.example.com`.
- The other `VITE_*_URL` portal variables: deployed URLs for the other three frontends.

On the API deployment, set `ALLOWED_ORIGINS` to a comma-separated list of the four frontend origins. Local development already allows ports 5173–5176. Do not set a wildcard origin when enabling voting POST requests.

## PostgreSQL database and deterministic seed

The API uses PostgreSQL through the `@evoting/database` Drizzle package. SQLite/Turso remains only as legacy compatibility/test code; it is no longer selected by the API runtime.

```zsh
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed is repeatable and only upserts the `DEMO-00001` … `DEMO-05000` voter namespace. It creates 5,000 synthetic voters: 3,250 marked voted and 1,750 not voted. It does not create real voter identities or ballot records.

Useful commands:
- `pnpm db:migrate`: create/update PostgreSQL tables and indexes.
- `pnpm db:seed`: upsert deterministic demo voters.
- `pnpm db:studio`: open Drizzle Studio.
- `pnpm db:generate`: generate Drizzle migration files from schema changes.

The local Docker credentials are for development only. Use a managed PostgreSQL provider such as Neon for hosted deployments and set `DATABASE_URL` only on the API server.

## Workspaces
- `apps/api`: Hono API, current SQLite/Turso adapter and blockchain demo.
- `apps/admin`, `apps/voter`, `apps/candidate`, `apps/explorer`: independent Vite/React apps.
- `packages/ui`: shared shell, page headers, panels, metric cards, status and loading components.
- `packages/design-system`: shared light-theme tokens and responsive shell styles.
- `packages/contracts`: shared API/domain TypeScript contracts.
- `packages/api-client`: typed fetch client for existing routes; supports cross-origin API base configuration.
- `packages/database`: Drizzle schema, PostgreSQL client and migration.
- `packages/seed`: deterministic synthetic voter fixture (5,000 records; 3,250 voted and 1,750 not voted).

## Existing capabilities retained
SHA-256 hash-linked blocks, Merkle roots, Ed25519 demo signing, check-in/token workflow, ballot casting, receipts, block/chain verification, district synchronization simulation and tamper demonstration remain in the shared API and legacy admin app.

## Important security limitations
- Base64 ballot payload representation is **not encryption**.
- The legacy admin page contains hardcoded demonstration credentials.
- The current API returns a demo private session key to the browser and accepts it back on ballot submission.
- District sync is an in-memory simulation, not distributed consensus.
- Candidate tallies are not published by the current API; the new candidate portal does not infer totals from ballot payloads.
- Never use real identities, voter rolls, ballots or election operations.
- This is not a certified or secure election platform.

See [the architecture and migration plan](docs/architecture/monorepo-migration.md).
