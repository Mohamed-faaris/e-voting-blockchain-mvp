# Electronic Voting Blockchain MVP
> **Educational demonstration only. Not suitable for conducting real elections.**

This repository is a PNPM + Turborepo monorepo with four independent React portals, a shared Hono API, reusable UI/contracts packages and an optional PostgreSQL/Drizzle database package.

## Portal applications
| App | Local URL | Purpose |
|---|---|---|
| Admin | http://localhost:5173 | Election operations, all legacy admin routes and system controls |
| Voter | http://localhost:5174 | Check-in, one-time demo token, ballot casting and receipt |
| Candidate | http://localhost:5175 | Read-only candidate roster and chain/audit status |
| Explorer | http://localhost:5176 | Block inspection, Merkle references and receipt lookup |
| API | http://localhost:3000 | Shared Hono API and persistence |

## Run on Ubuntu / zsh
Requirements: Node.js 22+, PNPM 10+.
```zsh
corepack enable
pnpm install --no-frozen-lockfile # refresh workspace importer lockfile on this branch
pnpm dev
```
Build and validate:
```zsh
pnpm build
pnpm typecheck
pnpm test
```
Run a specific service:
```zsh
pnpm dev:api
pnpm dev:admin
pnpm dev:voter
pnpm dev:candidate
pnpm dev:explorer
```

## Workspaces
- `apps/api`: Hono API, current SQLite/Turso adapter and blockchain demo.
- `apps/admin`, `apps/voter`, `apps/candidate`, `apps/explorer`: independent Vite/React apps.
- `packages/ui`: common workspace shell and presentation components.
- `packages/design-system`: shared light-theme design tokens.
- `packages/contracts`: shared API/domain TypeScript contracts.
- `packages/api-client`: typed fetch client for the current routes.
- `packages/database`: Drizzle schema and PostgreSQL client/migration; opt-in, not yet wired into runtime storage.
- `packages/seed`: deterministic synthetic 5,000-voter fixture (3,250 voted / 1,750 not voted).

## PostgreSQL (opt-in)
Set `DATABASE_URL`, then run:
```zsh
pnpm db:generate
pnpm db:migrate
```
The running API still uses the existing SQLite/Turso adapter. The PostgreSQL schema must pass adapter parity and blockchain integrity tests before it can be made authoritative. This is deliberate: migration must not silently switch or lose demo data.

## Preserved capabilities
SHA-256 hash-linked blocks, Merkle roots, Ed25519 demo signing, check-in/token workflow, ballot casting, receipts, block/chain verification, district synchronization simulation and tamper demonstration remain in the shared API/legacy admin app.

## Security and product limitations
- Base64 ballot payload representation is **not encryption**.
- Admin demo credentials are hardcoded in the legacy demonstration UI.
- The current API issues a demo private key to the browser and accepts it back on cast.
- District sync is an in-memory simulation, not distributed consensus.
- The candidate portal deliberately shows no election result totals because the API does not currently publish independently verifiable tallies.
- No real identities, voter rolls, ballots or election operations should be used.
- This MVP is not a certified voting system and is unsuitable for real elections.

See [the architecture and migration plan](docs/architecture/monorepo-migration.md).
